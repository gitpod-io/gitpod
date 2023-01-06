curl -X POST "openfga:8080/stores/01GP4CRKXESH1JE5E0SNHMZYG1/authorization-models" \
  -H "content-type: application/json" \
  -d '{
  "type_definitions": [
    {
      "type": "user",
      "relations": {}
    },
    {
      "type": "team",
      "relations": {
        "owner": {
          "this": {}
        },
        "member": {
          "union": {
            "child": [
              {
                "this": {}
              },
              {
                "computedUserset": {
                  "object": "",
                  "relation": "owner"
                }
              }
            ]
          }
        },
        "grant_owner": {
          "computedUserset": {
            "object": "",
            "relation": "owner"
          }
        },
        "list_members": {
          "union": {
            "child": [
              {
                "computedUserset": {
                  "object": "",
                  "relation": "owner"
                }
              },
              {
                "computedUserset": {
                  "object": "",
                  "relation": "member"
                }
              }
            ]
          }
        },
        "add_members": {
          "computedUserset": {
            "object": "",
            "relation": "owner"
          }
        },
        "remove_members": {
          "computedUserset": {
            "object": "",
            "relation": "owner"
          }
        },
        "delete_team": {
          "computedUserset": {
            "object": "",
            "relation": "owner"
          }
        },
        "project_creator": {
          "union": {
            "child": [
              {
                "computedUserset": {
                  "object": "",
                  "relation": "owner"
                }
              },
              {
                "computedUserset": {
                  "object": "",
                  "relation": "member"
                }
              }
            ]
          }
        }
      },
      "metadata": {
        "relations": {
          "owner": {
            "directly_related_user_types": [
              {
                "type": "user"
              }
            ]
          },
          "member": {
            "directly_related_user_types": [
              {
                "type": "user"
              }
            ]
          },
          "grant_owner": {
            "directly_related_user_types": []
          },
          "list_members": {
            "directly_related_user_types": []
          },
          "add_members": {
            "directly_related_user_types": []
          },
          "remove_members": {
            "directly_related_user_types": []
          },
          "delete_team": {
            "directly_related_user_types": []
          },
          "project_creator": {
            "directly_related_user_types": []
          }
        }
      }
    },
    {
      "type": "project",
      "relations": {
        "maintainer": {
          "this": {}
        }
      },
      "metadata": {
        "relations": {
          "maintainer": {
            "directly_related_user_types": [
              {
                "type": "user"
              },
              {
                "type": "team",
                "relation": "member"
              }
            ]
          }
        }
      }
    }
  ],
  "schema_version": "1.1"
}'

curl -X POST "openfga:8080/stores/01GP4CRKXESH1JE5E0SNHMZYG1/check" \
  -H "content-type: application/json" \
  -d '{"tuple_key":{"user":"user:milan","relation":"maintainer","object":"project:project1"}}'

# Response: {"allowed":true}
b23f24d7-47f7-4366-a642-ce46b61b499e

curl -X GET "localhost:8080/stores/01GP4CRKXESH1JE5E0SNHMZYG1/changes" \
  -H "content-type: application/json"
