import { beforeAll, afterAll, beforeEach } from 'vitest'
import { setupServer } from 'msw/node'
import { handlers } from './__mocks__/handlers.js'

// Setup MSW server for API mocking
const server = setupServer(...handlers)

beforeAll(() => {
  // Enable request interception
  server.listen({ onUnhandledRequest: 'error' })
})

afterAll(() => {
  // Clean up after all tests are done
  server.close()
})

beforeEach(() => {
  // Reset any runtime request handlers we may add during the tests
  server.resetHandlers()
})

// Make server available globally for tests
declare global {
  var __MSW_SERVER__: typeof server
}

globalThis.__MSW_SERVER__ = server