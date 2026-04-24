import { useState, useCallback, useEffect, useRef } from "react"
import { supabase } from "@/lib/supabase"

export interface LyzrAgentConfig {
  enabled: boolean
  apiKey: string
  agentId: string
  ocrAgentId: string
  validatorAgentId: string
  userId: string
  sessionId: string
}

const STORAGE_KEY = "sandisk-lyzr-config"
const DB_KEY = "lyzr_agent_config"

function generateSessionId(agentId: string): string {
  const random = Math.random().toString(36).substring(2, 13)
  return `${agentId}-${random}`
}

function generateRandomUserId(): string {
  const random = Math.random().toString(36).substring(2, 10)
  return `user-${random}@demo.movate.com`
}

const defaultConfig: LyzrAgentConfig = {
  enabled: true,
  apiKey: "sk-default-D0plT8nq8DdRpw5LR956a7J4Df7Yo2QC",
  agentId: "69ea29fa48859962fb807a69",
  ocrAgentId: "69ea4e96b6a1f25b871d5302",
  validatorAgentId: "69ea4e968dccef41d94cc060",
  userId: "",
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
  if (!config.userId) {
    config.userId = generateRandomUserId()
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
  const configRef = useRef(config)
  configRef.current = config

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
    const newSessionId = generateSessionId(configRef.current.agentId)
    const newUserId = generateRandomUserId()
    setConfigState((prev) => {
      const next = { ...prev, sessionId: newSessionId, userId: newUserId }
      saveLocalConfig(next)
      return next
    })
    return { sessionId: newSessionId, userId: newUserId }
  }, [])

  const getConfig = useCallback(() => configRef.current, [])

  const isConfigured = !!(config.enabled && config.apiKey && config.agentId && config.userId)

  return { config, configRef, setConfig, isConfigured, resetSession, getConfig }
}
