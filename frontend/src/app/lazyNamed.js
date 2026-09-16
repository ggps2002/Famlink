import { lazy } from "react";

/**
 * React.lazy for a module that exports its component by name.
 *
 * `lazy()` requires the resolved module to have a `default`. About a dozen
 * screens in this app export a const instead — `export const Screen4 = …` — and
 * pointing plain `lazy()` at one of those fails in the worst possible way: the
 * import resolves, `default` is undefined, and React throws only when that route
 * renders. The build passes, the test suite passes, and one page is a white
 * screen until someone navigates to it.
 *
 * tests/architecture/lazyRoutes.test.js checks statically that every name passed
 * here is really exported by the module it names.
 *
 * @param {() => Promise<object>} load    the dynamic import
 * @param {string} name                   the export to use as the component
 */
export const lazyNamed = (load, name) =>
  lazy(() =>
    load().then((module) => {
      const component = module[name];

      if (!component) {
        // Fail with the name of the thing that is missing. React's own error
        // for an undefined lazy component names neither the module nor the
        // export, which makes this near-impossible to place from a stack trace.
        throw new Error(
          `lazyNamed: module has no export "${name}" ` +
            `(available: ${Object.keys(module).join(", ") || "none"})`
        );
      }

      return { default: component };
    })
  );

export default lazyNamed;
