// src/hooks/useUpload.js
// Custom hook for PDF upload with progress tracking, validation, and multi-doc list

import { useState, useCallback, useRef } from 'react';
import { uploadPDF } from '../utils/api';

export function useUpload() {
  const [uploadedDocs, setUploadedDocs] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState(null);
  const uploadingRef = useRef(false);

  const validateFile = useCallback((file, currentDocs) => {
    if (!file) throw new Error('No file selected.');
    if (file.type !== 'application/pdf') throw new Error('Only PDF files are accepted.');
    if (file.size > 50 * 1024 * 1024) throw new Error('File must be under 50 MB.');
    const isDuplicate = currentDocs.some(
      (d) => d.name === file.name && d.size === file.size && d.status !== 'error'
    );
    if (isDuplicate) throw new Error(`"${file.name}" has already been uploaded.`);
  }, []);

  const uploadFile = useCallback(async (file) => {
    if (uploadingRef.current) return false;

    // Validate against current docs list using functional read
    let validationError = null;
    setUploadedDocs((prev) => {
      try {
        validateFile(file, prev);
      } catch (e) {
        validationError = e.message;
      }
      return prev; // no change yet
    });

    // Wait for state read
    await new Promise((r) => setTimeout(r, 0));

    if (validationError) {
      setUploadError(validationError);
      return false;
    }

    uploadingRef.current = true;
    setUploadError(null);
    setUploadProgress(0);
    setIsUploading(true);

    const docId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    // Optimistically add doc as 'uploading'
    setUploadedDocs((prev) => [
      ...prev,
      {
        id: docId,
        name: file.name,
        size: file.size,
        status: 'uploading',
        pages: null,
        chunks: null,
        uploadedAt: new Date().toISOString(),
      },
    ]);

    try {
      const data = await uploadPDF(file, (pct) => setUploadProgress(pct));

      setUploadedDocs((prev) =>
        prev.map((d) =>
          d.id === docId
            ? {
                ...d,
                status: 'ready',
                pages: data.details?.pages ?? null,
                chunks: data.details?.chunksCreated ?? null,
              }
            : d
        )
      );
      setUploadProgress(100);
      return true;
    } catch (err) {
      setUploadError(err.message || 'Upload failed. Please try again.');
      setUploadedDocs((prev) =>
        prev.map((d) => (d.id === docId ? { ...d, status: 'error' } : d))
      );
      return false;
    } finally {
      uploadingRef.current = false;
      setIsUploading(false);
    }
  }, [validateFile]);

  const removeDoc = useCallback((id) => {
    setUploadedDocs((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const clearError = useCallback(() => setUploadError(null), []);

  return {
    uploadedDocs,
    isUploading,
    uploadProgress,
    uploadError,
    uploadFile,
    removeDoc,
    clearError,
  };
}
