/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as React from 'react';
import MuiThemeProvider from '@material-ui/core/styles/MuiThemeProvider';
import createMuiTheme from '@material-ui/core/styles/createMuiTheme';
import CssBaseline from '@material-ui/core/CssBaseline';
import * as Cookies from 'js-cookie';

const colors_light = {
  brand: '#0087BE',
  brand2: '#1AA6E4',
  background1: '#F7F7F7',
  background2: '#FFFFFF',
  background3: '#E6E6E6',
  paperShadow: '#cdcdcd',
  fontColor1: '#292929',
  fontColor2: '#4D4D4D',
  fontColor3: '#9F9F9F',
  disabled: '#9F9F9F',
}

const colors_dark = {
  brand: '#0087BE',
  brand2: '#1AA6E4',
  background1: '#1e1e1e',
  background2: '#262626',
  background3: '#4a4a4a',
  paperShadow: '#151515',
  fontColor1: '#e0e0e0',
  fontColor2: '#dedede',
  fontColor3: '#888',
  disabled: '#888',
};

const themeData = Cookies.getJSON('theme');
let _themeMode: 'dark'|'light' = 'dark';

if (themeData === undefined || typeof themeData === 'string' /* legacy */ ) {
    _themeMode = themeData === 'light' ? 'light' : 'dark';
} else {
    _themeMode = themeData.mode === 'light' ? 'light' : 'dark';
}
let _colors = _themeMode === 'light' ? colors_light : colors_dark; 
if (typeof themeData === 'object' && 'colors' in themeData) {
    for (const key of Object.keys(themeData.colors)) {
        const color = themeData.colors[key];
        if (color) {
            _colors[key] = color;
        }
    }
}

export const themeMode = _themeMode;
export const colors = _colors; 

export function getSvgPath(path: string): string {
    if (themeMode === 'light') {
        return path.replace('.svg', '_light.svg');
    }
    return path;
}

function setCSSVar(name: string, value: string) {
    document.documentElement.style
        .setProperty(name, value);
}

setCSSVar('--font-color1', colors.fontColor1);
setCSSVar('--font-color2', colors.fontColor2);
setCSSVar('--font-color3', colors.fontColor3);
setCSSVar('--brand-color1', colors.brand);
setCSSVar('--brand-color2', colors.brand2);
setCSSVar('--background-color1', colors.background1);
setCSSVar('--background-color2', colors.background2);
setCSSVar('--background-color3', colors.background3);

// A theme with custom primary and secondary color.
// It's optional.
const theme = createMuiTheme({
  palette: {
    background: {
        default: colors.background1,
        paper: colors.background2
    },
    primary: {
      light: colors.background1,
      main: colors.background1,
      dark: colors.background1,
      contrastText: colors.fontColor1,
    },
    secondary: {
      light: colors.brand,
      main: colors.brand,
      dark: colors.brand,
      contrastText: '#ffffff',
    },
    type: themeMode,
  },
  typography: {
      allVariants: {
          fontFamily: 'Montserrat',
          color: colors.fontColor2
      },
      h1: {
        fontFamily: 'Montserrat',
        fontSize: '2.2rem',
      },
      h2: {
        fontFamily: 'Montserrat',
        color: colors.fontColor3,
        fontSize: '1.5rem',
      },
      h3: {
        fontFamily: 'Montserrat',
        fontSize: '1.5rem',
      },
      h4: {
        fontFamily: 'Montserrat'
      }
  },
  overrides: {
    MuiButton: {
      root: {
        borderRadius: 100,
        fontSize: 16,
        fontWeight: 400,
        lineHeight: '1.45',
        padding: '8px 14px',
        textTransform: 'none',
        transition: 'none',
        minWidth: 110,
      },
      outlined: {
        borderWidth: 1,
        borderStyle: 'solid'
      },
      outlinedPrimary: {
        color: colors.fontColor1,
        borderColor: colors.fontColor1,
        boxShadow: `0px 0px 1px ${colors.fontColor1}`,
        '&:hover': {
          color: colors.brand2,
          borderColor: colors.brand2,
          textDecoration: "none",
        },
        '&:focus': {
          color: colors.brand2,
          borderColor: colors.brand2,
          textDecoration: "none",
        },
        '&:active': {
          color: colors.brand2,
          borderColor: colors.brand2,
          textDecoration: "none",
        },
        '&$disabled': {
          color: colors.disabled,
          borderColor: colors.disabled,
        }
      },
      outlinedSecondary: {
        color: themeMode === 'dark' ? colors.fontColor1 : colors.background1,
        backgroundColor: colors.brand,
        borderColor: colors.brand,
        boxShadow: `0px 0px 1px ${colors.brand}`,
        '&:hover': {
          color: themeMode === 'dark' ? colors.fontColor1 : colors.background1,
          backgroundColor: colors.brand2,
          borderColor: colors.brand2,
          textDecoration: "none",
        },
        '&:focus': {
          color: themeMode === 'dark' ? colors.fontColor1 : colors.background1,
          backgroundColor: colors.brand2,
          borderColor: colors.brand2,
          textDecoration: "none",
        },
        '&:active': {
          color: themeMode === 'dark' ? colors.fontColor1 : colors.background1,
          backgroundColor: colors.brand2,
          borderColor: colors.brand2,
          textDecoration: "none",
        },
        '&$disabled': {
          color: themeMode === 'dark' ? colors.fontColor1 : colors.background1,
          backgroundColor: colors.disabled,
          borderColor: colors.disabled,
          boxShadow: `0px 0px 1px ${colors.disabled}`,
        },
      },
    },
    MuiCheckbox: {
      colorPrimary: {
        '&$checked': {
          color: colors.fontColor1,
        },
      },
    },
    MuiPaper: {
      rounded: {
        borderRadius: 0,
      },
      elevation1: {
        backgroundColor: colors.background2,
        boxShadow: `0px 0px 1px ${colors.paperShadow}`,
      },
      elevation2: {
        backgroundColor: colors.background2,
        boxShadow: `0px 0px 1px ${colors.paperShadow}`,
      },
      elevation4: {
        boxShadow: 'none',
      },
      elevation8: {
        backgroundColor: colors.background2,
      },
      elevation24: {
        backgroundColor: colors.background2,
      },
    },
    MuiDialogActions: {
      action: {
        marginBottom: 7,
        marginRight: 11,
      },
    },
    MuiLink: {
        root: {
            color: colors.brand,
        }
    }
  },
  props: {
    MuiButtonBase: {
      disableRipple: true,
    },
  },
});

function withRoot<P>(Component: React.ComponentType<P>): React.ComponentType<P> {
  function WithRoot(props: P) {
    // MuiThemeProvider makes the theme available down the React tree
    // thanks to React context.
    return (
      <MuiThemeProvider theme={theme}>
        {/* CssBaseline kickstart an elegant, consistent, and simple baseline to build upon. */}
        <CssBaseline />
        <Component {...props} />
      </MuiThemeProvider>
    );
  }

  return WithRoot;
}

export default withRoot;
