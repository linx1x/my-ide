import type { WebpackOverrideFn } from "@remotion/bundler";

/** Import `.txt` as string (webpack `asset/source`). */
export const webpackOverride: WebpackOverrideFn = (currentConfiguration) => {
  return {
    ...currentConfiguration,
    module: {
      ...currentConfiguration.module,
      rules: [
        ...(currentConfiguration.module?.rules ?? []),
        {
          test: /\.txt$/i,
          type: "asset/source",
        },
      ],
    },
  };
};
