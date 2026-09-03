/* eslint-disable @typescript-eslint/no-empty-object-type */
/// <reference types="@testing-library/jest-dom" />

import type * as matchers from '@testing-library/jest-dom/matchers';

declare module '@vitest/expect' {
  interface Assertion<T = unknown> extends matchers.TestingLibraryMatchers<unknown, T> {}
  interface AsymmetricMatchersContaining extends matchers.TestingLibraryMatchers<
    unknown,
    unknown
  > {}
}
