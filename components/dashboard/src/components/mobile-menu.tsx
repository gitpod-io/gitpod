import * as React from "react";
import Button from "@material-ui/core/Button";
import Menu from "@material-ui/core/Menu";
import MenuItem from "@material-ui/core/MenuItem";
import { Branding } from "@gitpod/gitpod-protocol";
import ExpandMoreIcon from "@material-ui/icons/ExpandMore";

const createAnchor = (name: string, url: string, handleClose: any) => {
  if (url.startsWith("/")) {
    return (
      <MenuItem
        onClick={handleClose}
        component="a"
        href={url}
        key={"a-" + name}
      >
        {name}
      </MenuItem>
    );
  } else {
    return (
      <MenuItem
        onClick={handleClose}
        component="a"
        href={url}
        key={"a-" + name}
        target="_blank"
        rel="noopener"
      >
        {name}
      </MenuItem>
    );
  }
};

export default class MobileMenu extends React.Component<{ items: any }> {
  state = {
    anchorEl: null,
  };

  handleClick = (e: any) => {
    this.setState({ anchorEl: e.currentTarget });
  };

  handleClose = () => {
    this.setState({ anchorEl: null });
  };

  render() {
    const { items } = this.props;
    return (
      <div className="mobile-menu">
        <Button
          aria-controls="mobile-menu"
          style={{ marginRight: "1rem" }}
          aria-haspopup="true"
          onClick={this.handleClick}
        >
          Navigation Menu <ExpandMoreIcon />
        </Button>
        <Menu
          open={Boolean(this.state.anchorEl)}
          anchorEl={this.state.anchorEl}
          onClose={this.handleClose}
          id="mobile-menu"
          keepMounted
          getContentAnchorEl={null}
          anchorOrigin={{
            vertical: "bottom",
            horizontal: "center",
          }}
          transformOrigin={{
            vertical: "top",
            horizontal: "center",
          }}
        >
          {items.map(({ name, url }: Branding.Link) =>
            createAnchor(name, url, this.handleClose)
          )}
        </Menu>
      </div>
    );
  }
}
