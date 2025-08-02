"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Plus,
  History,
  FolderOpen,
  Settings,
  Volume2,
  Send,
  Bot,
  User,
  Sparkles,
  Loader2,
  Upload,
  FileText,
  Pause,
  Sun,
  Moon,
  X,
  Mic,
  MicOff,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  suggestions?: string[]
}

interface FileData {
  name: string
  path: string
  enabled: boolean
}

interface ChatHistoryItem {
  id: string
  title: string
  messages: Message[]
  createdAt: Date
}

interface SidebarButton {
  icon: React.ReactNode
  label: string
  action: () => void
  variant?: "default" | "destructive"
}

// Fixed Voice Recognition Hook
function useSimpleVoiceRecognition() {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState("")
  const [isSupported, setIsSupported] = useState(false)
  const recognitionRef = useRef<any>(null)

  // Check support after component mounts (client-side only)
  useEffect(() => {
    setIsSupported("SpeechRecognition" in window || "webkitSpeechRecognition" in window)
  }, [])

  const startListening = () => {
    if (!isSupported) return

    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      const recognition = new SpeechRecognition()

      recognition.continuous = false
      recognition.interimResults = false
      recognition.lang = "en-US"

      recognition.onstart = () => setIsListening(true)
      recognition.onend = () => setIsListening(false)

      recognition.onresult = (event: any) => {
        const result = event.results[0][0].transcript
        setTranscript(result)
      }

      recognition.onerror = () => {
        setIsListening(false)
        alert("Voice recognition error. Please try again.")
      }

      recognitionRef.current = recognition
      recognition.start()
    } catch (error) {
      alert("Voice recognition not supported in this browser")
    }
  }

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      setIsListening(false)
    }
  }

  return { isListening, transcript, startListening, stopListening, isSupported, setTranscript }
}

export default function FuturisticGeminiChatbot() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [sidebarExpanded, setSidebarExpanded] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showFiles, setShowFiles] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [files, setFiles] = useState<FileData[]>([])
  const [isReading, setIsReading] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(true)
  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([])
  const [mounted, setMounted] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Voice Recognition
  const { isListening, transcript, startListening, stopListening, isSupported, setTranscript } =
    useSimpleVoiceRecognition()

  // Fix hydration by ensuring client-side only rendering
  useEffect(() => {
    setMounted(true)
    const savedTheme = localStorage.getItem("darkMode")
    if (savedTheme !== null) {
      setIsDarkMode(savedTheme === "true")
    }
    loadFiles()
    loadChatHistory()
  }, [])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Handle voice transcript
  useEffect(() => {
    if (transcript && !isListening) {
      setInput(transcript)
      setTranscript("")
    }
  }, [transcript, isListening, setTranscript])

  const loadFiles = async () => {
    try {
      const response = await fetch("http://localhost:5000/get_files")
      const data = await response.json()
      const fileList = Object.entries(data).map(([name, fileData]: [string, any]) => ({
        name,
        path: fileData.path,
        enabled: fileData.enabled,
      }))
      setFiles(fileList)
    } catch (error) {
      console.log("Backend not connected - running in demo mode")
      setFiles([
        { name: "demo.pdf", path: "/demo.pdf", enabled: true },
        { name: "sample.pdf", path: "/sample.pdf", enabled: false },
      ])
    }
  }

  const loadChatHistory = () => {
    try {
      const saved = localStorage.getItem("chatHistory")
      if (saved) {
        const parsed = JSON.parse(saved)
        setChatHistory(
          parsed.map((item: any) => ({
            ...item,
            createdAt: new Date(item.createdAt),
            messages: item.messages.map((msg: any) => ({
              ...msg,
              timestamp: new Date(msg.timestamp),
            })),
          })),
        )
      }
    } catch (error) {
      console.error("Error loading chat history:", error)
    }
  }

  const saveChatHistory = (history: ChatHistoryItem[]) => {
    try {
      localStorage.setItem("chatHistory", JSON.stringify(history))
    } catch (error) {
      console.error("Error saving chat history:", error)
    }
  }

  const handleSendMessage = async (messageText?: string) => {
    const textToSend = messageText || input
    if (!textToSend.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: textToSend,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)

    try {
      const response = await fetch("http://localhost:5000/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: textToSend }),
      })

      const data = await response.json()

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.response,
        timestamp: new Date(),
        suggestions: data.suggestions || [],
      }

      setMessages((prev) => [...prev, aiMessage])
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content:
          "❌ Sorry, I encountered an error. Please make sure your Python backend is running on http://localhost:5000",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleNewChat = async () => {
    if (messages.length > 0) {
      const newHistoryItem: ChatHistoryItem = {
        id: Date.now().toString(),
        title: messages[0]?.content.slice(0, 50) + "..." || "New Chat",
        messages: [...messages],
        createdAt: new Date(),
      }
      const updatedHistory = [newHistoryItem, ...chatHistory].slice(0, 50)
      setChatHistory(updatedHistory)
      saveChatHistory(updatedHistory)
    }

    try {
      await fetch("http://localhost:5000/new_chat", { method: "POST" })
    } catch (error) {
      console.error("Error starting new chat:", error)
    }

    setMessages([])
    setInput("")
  }

  const loadChatFromHistory = (historyItem: ChatHistoryItem) => {
    setMessages(historyItem.messages)
    setShowHistory(false)
  }

  const deleteChatFromHistory = (chatId: string) => {
    const updatedHistory = chatHistory.filter((chat) => chat.id !== chatId)
    setChatHistory(updatedHistory)
    saveChatHistory(updatedHistory)
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const formData = new FormData()
    formData.append("pdf", file)

    try {
      const response = await fetch("http://localhost:5000/upload", {
        method: "POST",
        body: formData,
      })

      if (response.ok) {
        loadFiles()
      }
    } catch (error) {
      console.error("Error uploading file:", error)
    }
  }

  const toggleFile = async (filename: string, enabled: boolean) => {
    try {
      await fetch("http://localhost:5000/toggle_file", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ filename, enabled }),
      })
      loadFiles()
    } catch (error) {
      console.error("Error toggling file:", error)
    }
  }

  const handleReadAloud = async (text: string) => {
    if (isReading) {
      await fetch("http://localhost:5000/stop_read_aloud", { method: "POST" })
      setIsReading(false)
    } else {
      await fetch("http://localhost:5000/read_aloud", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      })
      setIsReading(true)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode)
    localStorage.setItem("darkMode", (!isDarkMode).toString())
  }

  const handleVoiceToggle = () => {
    if (isListening) {
      stopListening()
    } else {
      startListening()
    }
  }

  // REMOVED STOP BUTTON - Only keep essential buttons
  const sidebarButtons: SidebarButton[] = [
    {
      icon: isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />,
      label: isDarkMode ? "Light Mode" : "Dark Mode",
      action: toggleTheme,
    },
    {
      icon: <Plus className="w-5 h-5" />,
      label: "New Chat",
      action: handleNewChat,
    },
    {
      icon: <History className="w-5 h-5" />,
      label: "History",
      action: () => setShowHistory(true),
    },
    {
      icon: <FolderOpen className="w-5 h-5" />,
      label: "Manage Files",
      action: () => setShowFiles(true),
    },
    {
      icon: <Settings className="w-5 h-5" />,
      label: "Settings",
      action: () => setShowSettings(true),
    },
    {
      icon: isReading ? <Pause className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />,
      label: isReading ? "Pause Reading" : "Read Last Message",
      action: () => {
        if (messages.length > 0) {
          const lastMessage = messages[messages.length - 1]
          if (lastMessage.role === "assistant") {
            handleReadAloud(lastMessage.content)
          }
        }
      },
    },
  ]

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return null
  }

  return (
    <div
      className={`min-h-screen transition-colors duration-300 ${
        isDarkMode
          ? "bg-gradient-to-br from-slate-900 via-teal-900 to-slate-900 text-white"
          : "bg-gradient-to-br from-slate-100 via-teal-100 to-slate-100 text-slate-900"
      }`}
    >
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div
          className={`absolute -top-40 -right-40 w-80 h-80 rounded-full blur-3xl animate-pulse ${
            isDarkMode ? "bg-teal-500/10" : "bg-teal-500/20"
          }`}
        />
        <div
          className={`absolute -bottom-40 -left-40 w-80 h-80 rounded-full blur-3xl animate-pulse delay-1000 ${
            isDarkMode ? "bg-cyan-500/10" : "bg-cyan-500/20"
          }`}
        />
      </div>

      <div className="flex min-h-screen">
        {/* FIXED Sidebar */}
        <motion.div
          className={`fixed left-0 top-0 h-full z-20 flex flex-col p-4 space-y-3 transition-all duration-300 ${
            isDarkMode ? "bg-slate-900/90" : "bg-white/90"
          } backdrop-blur-sm border-r ${isDarkMode ? "border-teal-500/20" : "border-teal-500/30"} overflow-y-auto`}
          style={{ width: sidebarExpanded ? "200px" : "80px" }}
          initial={{ x: -100, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
          onMouseEnter={() => setSidebarExpanded(true)}
          onMouseLeave={() => setSidebarExpanded(false)}
        >
          {sidebarButtons.map((button, index) => (
            <motion.div
              key={button.label}
              initial={{ x: -50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: index * 0.1, duration: 0.3 }}
            >
              <Button
                onClick={button.action}
                variant="ghost"
                className={`
                  relative group overflow-hidden backdrop-blur-sm border transition-all duration-300 rounded-xl h-12 w-full
                  ${
                    isDarkMode
                      ? "bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border-teal-500/30"
                      : "bg-teal-500/30 hover:bg-teal-500/40 text-teal-600 border-teal-500/40"
                  }
                  ${sidebarExpanded ? "justify-start px-4" : "justify-center px-0"}
                `}
              >
                <div className="relative z-10 flex items-center space-x-3">
                  {button.icon}
                  <AnimatePresence>
                    {sidebarExpanded && (
                      <motion.span
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: "auto" }}
                        exit={{ opacity: 0, width: 0 }}
                        transition={{ duration: 0.2 }}
                        className="text-sm font-medium whitespace-nowrap"
                      >
                        {button.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              </Button>
            </motion.div>
          ))}
        </motion.div>

        {/* Main Content - FIXED LAYOUT */}
        <div
          className="flex-1 flex flex-col transition-all duration-300"
          style={{ marginLeft: sidebarExpanded ? "200px" : "80px" }}
        >
          {/* Header */}
          <motion.div
            className={`flex items-center justify-center p-6 border-b backdrop-blur-sm ${
              isDarkMode ? "border-teal-500/20" : "border-teal-500/30"
            }`}
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center space-x-3">
              <motion.div
                className={`p-2 rounded-full ${isDarkMode ? "bg-teal-500/20" : "bg-teal-500/30"}`}
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
              >
                <Sparkles className={`w-6 h-6 ${isDarkMode ? "text-teal-300" : "text-teal-600"}`} />
              </motion.div>
              <h1
                className={`text-2xl font-bold bg-gradient-to-r bg-clip-text text-transparent ${
                  isDarkMode ? "from-teal-300 to-cyan-300" : "from-teal-600 to-cyan-600"
                }`}
              >
                Gemini AI Assistant
              </h1>
            </div>
          </motion.div>

          {/* Messages Area - FIXED SCROLLING */}
          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full p-6">
              <AnimatePresence>
                {messages.length === 0 ? (
                  <motion.div
                    className="flex flex-col items-center justify-center h-full text-center space-y-4"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5 }}
                  >
                    <motion.div
                      className={`p-4 rounded-full ${isDarkMode ? "bg-teal-500/10" : "bg-teal-500/20"}`}
                      animate={{
                        scale: [1, 1.1, 1],
                        rotate: [0, 5, -5, 0],
                      }}
                      transition={{
                        duration: 4,
                        repeat: Number.POSITIVE_INFINITY,
                        ease: "easeInOut",
                      }}
                    >
                      <Bot className={`w-12 h-12 ${isDarkMode ? "text-teal-300" : "text-teal-600"}`} />
                    </motion.div>
                    <div className="space-y-2">
                      <h2 className={`text-xl font-semibold ${isDarkMode ? "text-teal-300" : "text-teal-600"}`}>
                        Welcome to the Future
                      </h2>
                      <p className={`max-w-md ${isDarkMode ? "text-teal-200/70" : "text-teal-700/70"}`}>
                        Start a conversation with your Gemini AI assistant. Upload PDFs, ask questions, or use the 🎤
                        voice button to speak your message!
                      </p>
                    </div>
                  </motion.div>
                ) : (
                  <div className="space-y-4 pb-4">
                    {messages.map((message, index) => (
                      <motion.div
                        key={message.id}
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.3, delay: index * 0.1 }}
                        className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <Card
                          className={`
                          max-w-[80%] p-4 backdrop-blur-sm border transition-colors duration-300
                          ${
                            message.role === "user"
                              ? isDarkMode
                                ? "bg-teal-500/20 border-teal-500/30 text-teal-100"
                                : "bg-teal-500/30 border-teal-500/40 text-teal-800"
                              : isDarkMode
                                ? "bg-slate-800/50 border-slate-700/50 text-slate-100"
                                : "bg-white/50 border-slate-300/50 text-slate-800"
                          }
                        `}
                        >
                          <div className="flex items-start space-x-3">
                            <div
                              className={`
                              p-2 rounded-full flex-shrink-0
                              ${
                                message.role === "user"
                                  ? isDarkMode
                                    ? "bg-teal-500/30"
                                    : "bg-teal-500/40"
                                  : isDarkMode
                                    ? "bg-slate-700/50"
                                    : "bg-slate-200/50"
                              }
                            `}
                            >
                              {message.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                            </div>
                            <div className="flex-1">
                              <div className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</div>
                              <p className="text-xs opacity-50 mt-2">{message.timestamp.toLocaleTimeString()}</p>

                              {message.suggestions && message.suggestions.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-3">
                                  {message.suggestions.map((suggestion, idx) => (
                                    <Button
                                      key={idx}
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setInput(suggestion)}
                                      className={`text-xs border transition-colors duration-300 ${
                                        isDarkMode
                                          ? "bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border-teal-500/30"
                                          : "bg-teal-500/20 hover:bg-teal-500/30 text-teal-600 border-teal-500/40"
                                      }`}
                                    >
                                      {suggestion}
                                    </Button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </Card>
                      </motion.div>
                    ))}

                    {isLoading && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex justify-start"
                      >
                        <Card
                          className={`backdrop-blur-sm p-4 border transition-colors duration-300 ${
                            isDarkMode ? "bg-slate-800/50 border-slate-700/50" : "bg-white/50 border-slate-300/50"
                          }`}
                        >
                          <div className="flex items-center space-x-3">
                            <div className={`p-2 rounded-full ${isDarkMode ? "bg-slate-700/50" : "bg-slate-200/50"}`}>
                              <Bot className="w-4 h-4" />
                            </div>
                            <div className="flex items-center space-x-2">
                              <Loader2
                                className={`w-4 h-4 animate-spin ${isDarkMode ? "text-teal-400" : "text-teal-600"}`}
                              />
                              <span className={`text-sm ${isDarkMode ? "text-teal-300" : "text-teal-600"}`}>
                                Gemini is thinking...
                              </span>
                            </div>
                          </div>
                        </Card>
                      </motion.div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </AnimatePresence>
            </ScrollArea>
          </div>

          {/* Input Area with Voice */}
          <motion.div
            className={`p-6 border-t backdrop-blur-sm transition-colors duration-300 ${
              isDarkMode ? "border-teal-500/20" : "border-teal-500/30"
            }`}
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <div className="flex items-center space-x-3">
              <div className="flex-1 relative">
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type your message or click 🎤 to speak..."
                  className={`pr-12 h-12 rounded-xl backdrop-blur-sm transition-colors duration-300 focus:ring-2 ${
                    isDarkMode
                      ? "bg-slate-800/50 border-teal-500/30 text-white placeholder-teal-200/50 focus:border-teal-400 focus:ring-teal-400/20"
                      : "bg-white/50 border-teal-500/40 text-slate-900 placeholder-teal-600/50 focus:border-teal-500 focus:ring-teal-500/20"
                  }`}
                  disabled={isLoading}
                />

                {/* Voice Button */}
                <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                  <motion.div
                    animate={isListening ? { scale: [1, 1.1, 1] } : { scale: 1 }}
                    transition={{ duration: 1, repeat: isListening ? Number.POSITIVE_INFINITY : 0 }}
                  >
                    <Button
                      onClick={handleVoiceToggle}
                      variant="ghost"
                      size="sm"
                      disabled={isLoading || !isSupported}
                      className={`
                        h-8 w-8 p-0 transition-all duration-300 relative
                        ${
                          !isSupported
                            ? isDarkMode
                              ? "text-gray-500"
                              : "text-gray-400"
                            : isListening
                              ? isDarkMode
                                ? "text-red-400 bg-red-500/20 hover:bg-red-500/30"
                                : "text-red-600 bg-red-500/30 hover:bg-red-500/40"
                              : isDarkMode
                                ? "text-teal-400 hover:bg-teal-500/20"
                                : "text-teal-600 hover:bg-teal-500/30"
                        }
                      `}
                      title={
                        !isSupported ? "Voice not supported" : isListening ? "Stop listening" : "Start voice input"
                      }
                    >
                      {!isSupported ? (
                        <X className="w-4 h-4" />
                      ) : isListening ? (
                        <MicOff className="w-4 h-4" />
                      ) : (
                        <Mic className="w-4 h-4" />
                      )}

                      {isListening && (
                        <motion.div
                          className={`absolute inset-0 rounded-full border-2 ${
                            isDarkMode ? "border-red-400/50" : "border-red-600/50"
                          }`}
                          animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                          transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
                        />
                      )}
                    </Button>
                  </motion.div>
                </div>
              </div>

              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  onClick={() => handleSendMessage()}
                  disabled={!input.trim() || isLoading}
                  className={`h-12 px-6 rounded-xl backdrop-blur-sm transition-all duration-300 disabled:opacity-50 border ${
                    isDarkMode
                      ? "bg-teal-500/20 hover:bg-teal-500/30 border-teal-500/30 text-teal-300"
                      : "bg-teal-500/30 hover:bg-teal-500/40 border-teal-500/40 text-teal-600"
                  }`}
                >
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                </Button>
              </motion.div>
            </div>

            {/* Voice Status */}
            {isListening && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`mt-2 text-center text-sm ${isDarkMode ? "text-teal-300" : "text-teal-600"}`}
              >
                🎤 Listening... Speak now!
              </motion.div>
            )}
          </motion.div>
        </div>
      </div>

      {/* All Dialogs remain the same... */}
      <Dialog open={showFiles} onOpenChange={setShowFiles}>
        <DialogContent
          className={`max-w-md transition-colors duration-300 ${
            isDarkMode
              ? "bg-slate-800/90 border-teal-500/30 text-white"
              : "bg-white/90 border-teal-500/40 text-slate-900"
          }`}
        >
          <DialogHeader>
            <DialogTitle className={isDarkMode ? "text-teal-300" : "text-teal-600"}>Manage PDF Files</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Button
              onClick={() => fileInputRef.current?.click()}
              className={`w-full border transition-colors duration-300 ${
                isDarkMode
                  ? "bg-teal-500/20 hover:bg-teal-500/30 border-teal-500/30 text-teal-300"
                  : "bg-teal-500/30 hover:bg-teal-500/40 border-teal-500/40 text-teal-600"
              }`}
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload PDF
            </Button>
            <input ref={fileInputRef} type="file" accept=".pdf" onChange={handleFileUpload} className="hidden" />

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {files.map((file) => (
                <div
                  key={file.name}
                  className={`flex items-center justify-between p-3 rounded-lg transition-colors duration-300 ${
                    isDarkMode ? "bg-slate-700/50" : "bg-slate-100/50"
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <FileText className={`w-4 h-4 ${isDarkMode ? "text-teal-400" : "text-teal-600"}`} />
                    <span className="text-sm truncate max-w-[200px]" title={file.name}>
                      {file.name}
                    </span>
                  </div>
                  <Switch checked={file.enabled} onCheckedChange={(checked) => toggleFile(file.name, checked)} />
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent
          className={`transition-colors duration-300 ${
            isDarkMode
              ? "bg-slate-800/90 border-teal-500/30 text-white"
              : "bg-white/90 border-teal-500/40 text-slate-900"
          }`}
        >
          <DialogHeader>
            <DialogTitle className={isDarkMode ? "text-teal-300" : "text-teal-600"}>Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className={isDarkMode ? "text-teal-200" : "text-teal-700"}>Gemini API Key</Label>
              <Input
                type="password"
                placeholder="Enter your Gemini API key..."
                className={`transition-colors duration-300 ${
                  isDarkMode
                    ? "bg-slate-700/50 border-teal-500/30 text-white"
                    : "bg-white/50 border-teal-500/40 text-slate-900"
                }`}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent
          className={`max-w-2xl max-h-[80vh] overflow-hidden transition-colors duration-300 ${
            isDarkMode
              ? "bg-slate-800/90 border-teal-500/30 text-white"
              : "bg-white/90 border-teal-500/40 text-slate-900"
          }`}
        >
          <DialogHeader>
            <DialogTitle className={isDarkMode ? "text-teal-300" : "text-teal-600"}>Chat History</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[60vh] space-y-3">
            {chatHistory.length === 0 ? (
              <div className={`text-center py-8 ${isDarkMode ? "text-teal-200/70" : "text-teal-700/70"}`}>
                No chat history yet...
              </div>
            ) : (
              chatHistory.map((chat) => (
                <div
                  key={chat.id}
                  className={`p-3 rounded-lg cursor-pointer transition-colors duration-300 group ${
                    isDarkMode ? "bg-slate-700/50 hover:bg-slate-700/70" : "bg-slate-100/50 hover:bg-slate-100/70"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1" onClick={() => loadChatFromHistory(chat)}>
                      <h3 className={`font-medium ${isDarkMode ? "text-teal-300" : "text-teal-600"}`}>{chat.title}</h3>
                      <p className={`text-sm ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
                        {chat.messages.length} messages • {chat.createdAt.toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteChatFromHistory(chat.id)
                      }}
                      className={`opacity-0 group-hover:opacity-100 transition-opacity duration-200 ${
                        isDarkMode ? "text-red-400 hover:bg-red-500/20" : "text-red-600 hover:bg-red-500/30"
                      }`}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
