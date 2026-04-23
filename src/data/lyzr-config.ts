import { useState, useCallback } from "react"

export interface LyzrAgentConfig {
  enabled: boolean
  apiKey: string
  agentId: string
  userId: string
  sessionId: string
}

const STORAGE_KEY = "sandisk-lyzr-config"

const defaultConfig: LyzrAgentConfig = {
  enabled: false,
  apiKey: "",
  agentId: "",
  userId: "",
  sessionId: "",
}

function loadConfig(): LyzrAgentConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return { ...defaultConfig, ...JSON.parse(stored) }
  } catch {
    // ignore
  }
  return defaultConfig
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
