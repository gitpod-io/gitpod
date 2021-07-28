/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { useContext, useEffect, useRef } from "react";
import * as monaco from "monaco-editor";
import { ThemeContext } from "../theme-context";

export default function MonacoEditor(props: { classes: string, disabled?: boolean, language: string, value: string, onChange: (value: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor>();
  const { isDark } = useContext(ThemeContext);

  useEffect(() => {
    if (containerRef.current) {
      editorRef.current = monaco.editor.create(containerRef.current, {
        value: props.value,
        language: props.language,
        minimap: {
          enabled: false,
        },
        renderLineHighlight: 'none',
      });
      editorRef.current.onDidChangeModelContent(() => {
        props.onChange(editorRef.current!.getValue());
      });
    }
    return () => editorRef.current?.dispose();
  }, []);

  useEffect(() => {
    if (editorRef.current && editorRef.current.getValue() !== props.value) {
      editorRef.current.setValue(props.value);
    }
  }, [ props.value ]);

  useEffect(() => {
    monaco.editor.setTheme(isDark ? 'vs-dark' : 'vs');
  }, [ isDark ]);

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.updateOptions({ readOnly: props.disabled });
    }
  }, [ props.disabled ]);

  return <div className={props.classes} ref={containerRef} />;
}