import { useState, useCallback, useEffect } from "react"
import { supabase } from "@/lib/supabase"

export interface LyzrAgentConfig {
  enabled: boolean
  apiKey: string
  agentId: string
  userId: string
  sessionId: string
}

const STORAGE_KEY = "sandisk-lyzr-config"
const DB_KEY = "lyzr_agent_config"

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

function loadLocalConfig(): LyzrAgentConfig {
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

function saveLocalConfig(config: LyzrAgentConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}

function saveToDb(config: LyzrAgentConfig) {
  const { sessionId: _, ...persistent } = config
  supabase
    .from("app_config")
    .upsert({ key: DB_KEY, value: persistent, updated_at: new Date().toISOString() })
    .then()
}

export function useLyzrConfig() {
  const [config, setConfigState] = useState<LyzrAgentConfig>(loadLocalConfig)

  useEffect(() => {
    supabase
      .from("app_config")
      .select("value")
      .eq("key", DB_KEY)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value && typeof data.value === "object") {
          setConfigState((prev) => {
            const merged = { ...prev, ...data.value as Partial<LyzrAgentConfig> }
            if (!merged.sessionId) merged.sessionId = generateSessionId(merged.agentId)
            saveLocalConfig(merged)
            return merged
          })
        }
      })
  }, [])

  const setConfig = useCallback((updates: Partial<LyzrAgentConfig>) => {
    setConfigState((prev) => {
      const next = { ...prev, ...updates }
      saveLocalConfig(next)
      saveToDb(next)
      return next
    })
  }, [])

  const resetSession = useCallback(() => {
    setConfigState((prev) => {
      const next = { ...prev, sessionId: generateSessionId(prev.agentId) }
      saveLocalConfig(next)
      return next
    })
  }, [])

  const isConfigured = !!(config.enabled && config.apiKey && config.agentId && config.userId)

  return { config, setConfig, isConfigured, resetSession }
}
