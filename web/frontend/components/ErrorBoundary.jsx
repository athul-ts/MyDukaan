import { Component } from "react";

/** Shows a message instead of a blank page if a screen fails to render. */
export class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error(error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <s-page heading="Countdown Timer Manager">
        <s-banner tone="critical" heading="This page couldn't load">
          <s-paragraph>{String(this.state.error?.message ?? this.state.error)}</s-paragraph>
          <s-button slot="secondary-actions" onClick={() => window.location.reload()}>
            Reload
          </s-button>
        </s-banner>
      </s-page>
    );
  }
}
