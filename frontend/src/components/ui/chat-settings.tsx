"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Settings, X, Key, Brain, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface ChatSettingsProps {
  isOpen: boolean
  onClose: () => void
}

export function ChatSettings({ isOpen, onClose }: ChatSettingsProps) {
  const [apiKey, setApiKey] = useState("")
  const [model, setModel] = useState("gpt-4o-mini")
  const [temperature, setTemperature] = useState("0.7")

  const handleSave = () => {
    // Save settings to localStorage or send to API
    localStorage.setItem("openai-api-key", apiKey)
    localStorage.setItem("ai-model", model)
    localStorage.setItem("ai-temperature", temperature)
    onClose()
  }

  if (!isOpen) return null

  return (
    <motion.div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="w-full max-w-md"
      >
        <Card className="bg-slate-800/90 border-teal-500/30 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-teal-300 flex items-center space-x-2">
              <Settings className="w-5 h-5" />
              <span>Chat Settings</span>
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose} className="text-teal-300 hover:bg-teal-500/20">
              <X className="w-4 h-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="api-key" className="text-teal-200 flex items-center space-x-2">
                <Key className="w-4 h-4" />
                <span>OpenAI API Key</span>
              </Label>
              <Input
                id="api-key"
                type="password"
                placeholder="sk-..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="bg-slate-700/50 border-teal-500/30 text-white placeholder-teal-200/50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="model" className="text-teal-200 flex items-center space-x-2">
                <Brain className="w-4 h-4" />
                <span>AI Model</span>
              </Label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger className="bg-slate-700/50 border-teal-500/30 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-teal-500/30">
                  <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                  <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                  <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="temperature" className="text-teal-200">
                Temperature: {temperature}
              </Label>
              <Input
                id="temperature"
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(e.target.value)}
                className="bg-slate-700/50 border-teal-500/30"
              />
            </div>

            <Button
              onClick={handleSave}
              className="w-full bg-teal-500/20 hover:bg-teal-500/30 border border-teal-500/30 text-teal-300"
            >
              <Save className="w-4 h-4 mr-2" />
              Save Settings
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
}
