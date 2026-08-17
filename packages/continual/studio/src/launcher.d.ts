export interface StudioServerOptions {
  browser?: boolean | string
  port?: number
  runtimeUrl: string
}

export interface StudioServer {
  close: () => Promise<void>
  url: string
}

export function startStudio(options: StudioServerOptions): Promise<StudioServer>
