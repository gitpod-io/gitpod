/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { useContext, useEffect, useRef } from 'react';
import * as monaco from 'monaco-editor';
import { ThemeContext } from '../theme-context';

monaco.editor.defineTheme('gitpod', {
  base: 'vs',
  inherit: true,
  rules: [],
  colors: {},
});
monaco.editor.defineTheme('gitpod-disabled', {
  base: 'vs',
  inherit: true,
  rules: [],
  colors: {
    'editor.background': '#F5F5F4', // Tailwind's warmGray 100 https://tailwindcss.com/docs/customizing-colors
  },
});
monaco.editor.defineTheme('gitpod-dark', {
  base: 'vs-dark',
  inherit: true,
  rules: [],
  colors: {
    'editor.background': '#292524', // Tailwind's warmGray 800 https://tailwindcss.com/docs/customizing-colors
  },
});
monaco.editor.defineTheme('gitpod-dark-disabled', {
  base: 'vs-dark',
  inherit: true,
  rules: [],
  colors: {
    'editor.background': '#44403C', // Tailwind's warmGray 700 https://tailwindcss.com/docs/customizing-colors
  },
});

export interface MonacoEditorProps {
  classes: string;
  disabled?: boolean;
  language: string;
  value: string;
  onChange: (value: string) => void;
}

export default function MonacoEditor(props: MonacoEditorProps) {
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
        lineNumbers: 'off',
        glyphMargin: false,
        folding: false,
      });
      editorRef.current.onDidChangeModelContent(() => {
        props.onChange(editorRef.current!.getValue());
      });
      // 8px top margin: https://github.com/Microsoft/monaco-editor/issues/1333
      editorRef.current.changeViewZones((accessor) => {
        accessor.addZone({
          afterLineNumber: 0,
          heightInPx: 8,
          domNode: document.createElement('div'),
        });
      });
    }
    return () => editorRef.current?.dispose();
  }, []);

  useEffect(() => {
    if (editorRef.current && editorRef.current.getValue() !== props.value) {
      editorRef.current.setValue(props.value);
    }
  }, [props.value]);

  useEffect(() => {
    monaco.editor.setTheme(
      props.disabled ? (isDark ? 'gitpod-dark-disabled' : 'gitpod-disabled') : isDark ? 'gitpod-dark' : 'gitpod',
    );
    if (editorRef.current) {
      editorRef.current.updateOptions({ readOnly: props.disabled });
    }
  }, [props.disabled, isDark]);

  return <div className={props.classes} ref={containerRef} />;
}
