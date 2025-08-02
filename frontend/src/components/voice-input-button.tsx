"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Mic, MicOff, Volume2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition"

interface VoiceInputButtonProps {
  onTranscript: (text: string) => void
  isDarkMode: boolean
  disabled?: boolean
}

export function VoiceInputButton({ onTranscript, isDarkMode, disabled }: VoiceInputButtonProps) {
  const { transcript, isListening, isSupported, startListening, stopListening, resetTranscript, error } =
    useSpeechRecognition()

  const [showTranscript, setShowTranscript] = useState(false)

  useEffect(() => {
    if (transcript && !isListening) {
      onTranscript(transcript)
      resetTranscript()
    }
  }, [transcript, isListening, onTranscript, resetTranscript])

  useEffect(() => {
    if (transcript) {
      setShowTranscript(true)
      const timer = setTimeout(() => setShowTranscript(false), 3000)
      return () => clearTimeout(timer)
    }
  }, [transcript])

  const handleToggleListening = () => {
    if (isListening) {
      stopListening()
    } else {
      startListening()
    }
  }

  if (!isSupported) {
    return (
      <Button
        variant="ghost"
        size="sm"
        disabled
        className={`h-8 w-8 p-0 ${isDarkMode ? "text-gray-500" : "text-gray-400"}`}
        title="Speech recognition not supported"
      >
        <AlertCircle className="w-4 h-4" />
      </Button>
    )
  }

  return (
    <div className="relative">
      <motion.div
        animate={isListening ? { scale: [1, 1.1, 1] } : { scale: 1 }}
        transition={{ duration: 1, repeat: isListening ? Number.POSITIVE_INFINITY : 0 }}
      >
        <Button
          onClick={handleToggleListening}
          variant="ghost"
          size="sm"
          disabled={disabled}
          className={`
            h-8 w-8 p-0 transition-all duration-300 relative
            ${
              isListening
                ? isDarkMode
                  ? "text-red-400 bg-red-500/20 hover:bg-red-500/30"
                  : "text-red-600 bg-red-500/30 hover:bg-red-500/40"
                : isDarkMode
                  ? "text-teal-400 hover:bg-teal-500/20"
                  : "text-teal-600 hover:bg-teal-500/30"
            }
          `}
          title={isListening ? "Stop listening" : "Start voice input"}
        >
          {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}

          {/* Listening indicator */}
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

      {/* Live transcript popup */}
      <AnimatePresence>
        {(showTranscript || isListening) && transcript && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            className={`
              absolute bottom-full right-0 mb-2 p-3 rounded-lg shadow-lg border max-w-xs z-50
              ${
                isDarkMode
                  ? "bg-slate-800/90 border-teal-500/30 text-white"
                  : "bg-white/90 border-teal-500/40 text-slate-900"
              }
            `}
          >
            <div className="flex items-start space-x-2">
              <Volume2 className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isDarkMode ? "text-teal-400" : "text-teal-600"}`} />
              <div>
                <p className="text-xs font-medium mb-1">{isListening ? "Listening..." : "Transcript:"}</p>
                <p className="text-sm">{transcript}</p>
              </div>
            </div>

            {/* Listening animation */}
            {isListening && (
              <div className="flex items-center justify-center mt-2 space-x-1">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className={`w-1 h-3 rounded-full ${isDarkMode ? "bg-teal-400" : "bg-teal-600"}`}
                    animate={{ scaleY: [1, 2, 1] }}
                    transition={{
                      duration: 1,
                      repeat: Number.POSITIVE_INFINITY,
                      delay: i * 0.2,
                    }}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className={`
              absolute bottom-full right-0 mb-2 p-2 rounded-lg shadow-lg border text-sm max-w-xs z-50
              ${
                isDarkMode
                  ? "bg-red-900/90 border-red-500/30 text-red-200"
                  : "bg-red-100/90 border-red-500/40 text-red-800"
              }
            `}
          >
            <div className="flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <p>{error}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
