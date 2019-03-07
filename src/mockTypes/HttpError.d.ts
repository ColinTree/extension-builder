declare class HttpError extends Error {
  name: string
  status: number
  headers: { [key: string]: string }
}