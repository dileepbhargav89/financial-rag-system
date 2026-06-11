// src/hooks/useChat.js
// Custom hook managing chat history, query submission, and loading states

import { useState, useCallback, useRef } from 'react';
import { askQuestion, getInsights } from '../utils/api';

export function useChat() {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  // Use a ref for isLoading inside callbacks to avoid stale-closure issues
  const loadingRef = useRef(false);

  const addMessage = useCallback((role, content, sources = [], metadata = {}) => {
    const message = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      role,
      content,
      sources,
      metadata,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, message]);
    return message;
  }, []);

  const sendMessage = useCallback(
    async (query) => {
      if (!query || !query.trim() || loadingRef.current) return;

      loadingRef.current = true;
      setError(null);
      setIsLoading(true);

      // Snapshot current messages for history BEFORE adding user message
      // Using functional update to read latest state
      let historySnapshot = [];
      setMessages((prev) => {
        historySnapshot = prev.slice(-10).map((m) => ({ role: m.role, content: m.content }));
        const userMsg = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          role: 'user',
          content: query.trim(),
          sources: [],
          metadata: {},
          timestamp: new Date().toISOString(),
        };
        return [...prev, userMsg];
      });

      // Small delay so state updates flush before the async call
      await new Promise((r) => setTimeout(r, 0));

      try {
        const data = await askQuestion(query.trim(), historySnapshot);
        setMessages((prev) => [
          ...prev,
          {
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            role: 'assistant',
            content: data.answer,
            sources: data.sources || [],
            metadata: { query: data.query, timestamp: data.timestamp },
            timestamp: new Date().toISOString(),
          },
        ]);
      } catch (err) {
        const msg = err.message || 'Something went wrong. Please try again.';
        setError(msg);
        setMessages((prev) => [
          ...prev,
          {
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            role: 'system',
            content: `Error: ${msg}`,
            sources: [],
            metadata: { isError: true },
            timestamp: new Date().toISOString(),
          },
        ]);
      } finally {
        loadingRef.current = false;
        setIsLoading(false);
      }
    },
    [] // No deps — uses functional state updates and refs throughout
  );

  const fetchInsight = useCallback(async (type) => {
    if (loadingRef.current) return;

    const labels = {
      summary: '📊 Summarize financial performance',
      risks: '⚠️ What are the key financial risks?',
    };

    loadingRef.current = true;
    setError(null);
    setIsLoading(true);

    setMessages((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        role: 'user',
        content: labels[type] || type,
        sources: [],
        metadata: {},
        timestamp: new Date().toISOString(),
      },
    ]);

    try {
      const data = await getInsights(type);
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          role: 'assistant',
          content: data.answer,
          sources: data.sources || [],
          metadata: {},
          timestamp: new Date().toISOString(),
        },
      ]);
    } catch (err) {
      const msg = err.message || 'Failed to generate insight.';
      setError(msg);
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          role: 'system',
          content: `Error: ${msg}`,
          sources: [],
          metadata: { isError: true },
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      loadingRef.current = false;
      setIsLoading(false);
    }
  }, []);

  const clearChat = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return { messages, isLoading, error, sendMessage, fetchInsight, clearChat,addMessage };
}
