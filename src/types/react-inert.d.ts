import "react";

/**
 * React 18 does not type the `inert` attribute yet, and beUI's Select/Tabs use
 * it to keep closed panels out of the tab order. Passing an empty string
 * renders a real `inert` attribute in React 18 (a boolean `true` is dropped
 * with a warning), which is what the components rely on.
 */
declare module "react" {
  interface HTMLAttributes<T> {
    inert?: "" | undefined;
  }
}
