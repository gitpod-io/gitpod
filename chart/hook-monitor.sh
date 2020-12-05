####################################################################################################
#                                                                                                  #
#   Hook Monitor: A bash script to monitor (by fetching the logs) the hooks added to kubernetes    #
#   jobs. Can be used for single job and multile jobs and request logs at configurable intervals.  #
#                                                                                                  # 
#   Usage: ./hook-monitor.sh -n <namespace> <subcommand>                                           #
#   [If the namespace flag is ommitted it resorts to default namespace.]                           #
#                                                                                                  #
#   Subcommands:                                                                                   #
#   * jobs: list all jobs in a given namespace.                                                    #
#     Example: ./hook-monitor.sh jobs                                                              #    
#                                                                                                  #
#   * logs: start monitoring logs of a given job(s).                                               #
#     Flags:                                                                                       #
#     * -i: set the fetch interval                                                                 #
#     * -a: fetch logs for all the available jobs                                                  #
#     Examples:                                                                                    #
#     ./hook-monitor.sh logs -a [fetch logs from all the jobs with the default interval]           #
#     ./hook-monitor.sh logs -i 5 <job-1> <job-2> <job-2>                                          #
#     [fetch logs from the pods of jobs job-1, job-2 and job-3 at 5 sec intervals]                 #
#                                                                                                  #
####################################################################################################


KUBECTLCMD=$(which kubectl)

# Check if namespace is provided as an argument
if [ "$1" = "-n" ]
then
    NAMESPACE=$2
    shift; shift
fi

# Get all the jobs for the current namespace
if [[ -z $NAMESPACE ]]; 
then
    JOBS=$($KUBECTLCMD get jobs)
else
    JOBS=$($KUBECTLCMD get jobs --namespace=$NAMESPACE)
fi

NFIELDS=$(echo $JOBS | awk '{print NF}')

# Set default interval for collecting job logs
INTERVAL=3

# Format the output to show logs
format_output () {
    TIMECMD=$(date)
    echo "\n $4 \n Job Name: $1 \n Pod Name: $2 \n Logs: $3 \n\n"
}

# Fetch the logs after resolving the pods from the jobs
fetch_logs () {
    JOB=$1
    TIMECMD=$(date)
    if [[ -z $NAMESPACE ]]; 
    then
        POD_NAME_CMD=$($KUBECTLCMD describe job $JOB | grep 'Events:' -A 4 | grep 'Message' -A 3 | grep 'Created pod: ' | sed -n -e 's/^.*Created\ pod: //p')
    else
        POD_NAME_CMD=$($KUBECTLCMD describe job $JOB --namespace=$NAMESPACE | grep 'Events:' -A 4 | grep 'Message' -A 3 | grep 'Created pod: ' | sed -n -e 's/^.*Created\ pod: //p')
    fi

    if [[ -z $POD_NAME_CMD ]];
    then
        echo "\n $TIMECMD \nPod not created for job $JOB yet. \n"
    else
        if [[ -z $NAMESPACE ]];
        then
            LOGS=$($KUBECTLCMD logs $POD_NAME_CMD 2>&1)
        else
            LOGS=$(KUBECTLCMD logs $POD_NAME_CMD --namespace=$NAMESPACE 2>&1)
        fi

        format_output $JOB $POD_NAME_CMD "$LOGS" "$TIMECMD"
    fi
}

# Show all the ongoing kubernetes jobs
show_jobs () {
    if [ $NFIELDS -lt 5 ]
    then
        echo "No jobs found in the namespace"
        exit 1
    fi

    field=5
    while [ $field -le $NFIELDS ]
    do
        JOBNAME=$(echo $JOBS | awk -v f=$field '{print $f}')
        echo "[*] - $JOBNAME"
        ((field+=4))
    done
}

if [ "$1" = "jobs" ]
then
    show_jobs
    shift
elif [ "$1" = "logs" ]
then

    if [ "$2" = "-i" ]
    then
        INTERVAL=$3
        shift; shift
    fi

    if [ "$2" = "-a" ]
    then

        if [ $NFIELDS -lt 5 ]
        then
            echo "No jobs found in the namespace"
            exit 1
        fi

        while true
        do
            field=5
            while [ $field -le $NFIELDS ]
            do
                JOBNAME=$(echo $JOBS | awk -v f=$field '{print $f}')
                fetch_logs $JOBNAME
                ((field+=4))
            done

            sleep $INTERVAL
        done

    else
        shift
        while true
        do
            for arg in "$@"; do
                echo "$arg"
                fetch_logs $arg
            done

            sleep $INTERVAL
        done
    fi
fi

