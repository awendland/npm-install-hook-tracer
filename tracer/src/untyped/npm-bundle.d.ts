declare module 'npm-bundle' {
  function npmBundle(args: string[], options: {verbose: boolean}, cb: (error: Error, output: {file: string}) => void): void

  export = npmBundle
}
