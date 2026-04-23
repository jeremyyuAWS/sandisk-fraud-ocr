import { useState, useCallback } from "react"

export interface LyzrAgentConfig {
  enabled: boolean
  apiKey: string
  agentId: string
  userId: string
  sessionId: string
}

const STORAGE_KEY = "sandisk-lyzr-config"

function generateSessionId(agentId: string): string {
  const random = Math.random().toString(36).substring(2, 13)
  return `${agentId}-${random}`
}

const defaultConfig: LyzrAgentConfig = {
  enabled: true,
  apiKey: "sk-default-D0plT8nq8DdRpw5LR956a7J4Df7Yo2QC",
  agentId: "69ea29fa48859962fb807a69",
  userId: "jeremy.yu@movate.com",
  sessionId: "",
}

function loadConfig(): LyzrAgentConfig {
  let config = { ...defaultConfig }
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) config = { ...defaultConfig, ...JSON.parse(stored) }
  } catch {
    // ignore
  }
  if (!config.sessionId) {
    config.sessionId = generateSessionId(config.agentId)
  }
  return config
}

function saveConfig(config: LyzrAgentConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}

export function useLyzrConfig() {
  const [config, setConfigState] = useState<LyzrAgentConfig>(loadConfig)

  const setConfig = useCallback((updates: Partial<LyzrAgentConfig>) => {
    setConfigState((prev) => {
      const next = { ...prev, ...updates }
      saveConfig(next)
      return next
    })
  }, [])

  const isConfigured = !!(config.enabled && config.apiKey && config.agentId && config.userId)

  return { config, setConfig, isConfigured }
}
