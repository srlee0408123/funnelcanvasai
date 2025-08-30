import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";

interface UploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  uploadType: "pdf" | "youtube" | "url" | null;
  workspaceId: string;
  canvasId: string;
}

export default function UploadModal({
  open,
  onOpenChange,
  uploadType,
  workspaceId,
  canvasId,
}: UploadModalProps) {
  const { toast } = useToast();
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (uploadType === "pdf" && selectedFile) {
        // Upload PDF file using FormData for actual file processing
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('title', title || selectedFile.name);
        formData.append('workspaceId', workspaceId);
        formData.append('canvasId', canvasId);

        const response = await fetch(`/api/workspaces/${workspaceId}/upload-pdf`, {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`Upload failed: ${response.statusText}`);
        }

        return await response.json();
      } else if ((uploadType === "youtube" || uploadType === "url") && url) {
        return await apiRequest("POST", `/api/workspaces/${workspaceId}/assets`, {
          type: uploadType,
          title: title || url,
          url: url,
          canvasId: canvasId,
          metaJson: {
            originalUrl: url,
          },
        });
      }
      throw new Error("Invalid upload data");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", workspaceId, "assets"] });
      toast({ title: "자료가 업로드되어 처리되었습니다." });
      onOpenChange(false);
      resetForm();
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "업로드 실패",
        description: "자료 업로드에 실패했습니다. 다시 시도해주세요.",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setUrl("");
    setTitle("");
    setSelectedFile(null);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== "application/pdf") {
        toast({
          title: "파일 형식 오류",
          description: "PDF 파일만 업로드 가능합니다.",
          variant: "destructive",
        });
        return;
      }
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        toast({
          title: "파일 크기 오류",
          description: "파일 크기는 10MB 이하여야 합니다.",
          variant: "destructive",
        });
        return;
      }
      setSelectedFile(file);
      if (!title) {
        setTitle(file.name.replace(".pdf", ""));
      }
    }
  };

  const isValidYouTubeUrl = (url: string) => {
    const youtubeRegex = /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)/;
    return youtubeRegex.test(url);
  };

  const isValidUrl = (url: string) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const canSubmit = () => {
    if (uploadType === "pdf") {
      return selectedFile && title.trim();
    } else if (uploadType === "youtube") {
      return url.trim() && isValidYouTubeUrl(url) && title.trim();
    } else if (uploadType === "url") {
      return url.trim() && isValidUrl(url) && title.trim();
    }
    return false;
  };

  const getModalTitle = () => {
    switch (uploadType) {
      case "pdf":
        return "PDF 문서 업로드";
      case "youtube":
        return "유튜브 영상 업로드";
      case "url":
        return "웹사이트 URL 업로드";
      default:
        return "자료 업로드";
    }
  };

  const getDescription = () => {
    switch (uploadType) {
      case "pdf":
        return "PDF 파일의 텍스트를 자동으로 추출하여 분석합니다.";
      case "youtube":
        return "영상의 자막과 설명을 자동으로 추출합니다.";
      case "url":
        return "웹페이지의 텍스트 내용을 자동으로 추출합니다.";
      default:
        return "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{getModalTitle()}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <p className="text-sm text-gray-500">{getDescription()}</p>

          {/* Title Input */}
          <div>
            <Label htmlFor="title" className="text-sm font-medium text-gray-700">
              제목
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="자료의 제목을 입력하세요"
              className="mt-1"
            />
          </div>

          {/* PDF Upload */}
          {uploadType === "pdf" && (
            <div>
              <Label className="text-sm font-medium text-gray-700">PDF 파일</Label>
              <div className="mt-1 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-primary-400 transition-colors">
                {selectedFile ? (
                  <div>
                    <i className="fas fa-file-pdf text-red-500 text-2xl mb-2"></i>
                    <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
                    <p className="text-xs text-gray-500">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                    <button
                      onClick={() => setSelectedFile(null)}
                      className="text-xs text-primary-600 hover:text-primary-700 mt-1"
                    >
                      다른 파일 선택
                    </button>
                  </div>
                ) : (
                  <div>
                    <i className="fas fa-cloud-upload-alt text-gray-400 text-2xl mb-2"></i>
                    <p className="text-gray-600 mb-2">PDF 파일을 드래그하거나 클릭하여 업로드</p>
                    <p className="text-xs text-gray-500 mb-3">최대 10MB</p>
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={handleFileSelect}
                      className="hidden"
                      id="file-input"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById("file-input")?.click()}
                    >
                      파일 선택
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* YouTube URL */}
          {uploadType === "youtube" && (
            <div>
              <Label htmlFor="youtube-url" className="text-sm font-medium text-gray-700">
                유튜브 URL
              </Label>
              <Input
                id="youtube-url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="mt-1"
              />
              {url && !isValidYouTubeUrl(url) && (
                <p className="text-xs text-red-600 mt-1">올바른 유튜브 URL을 입력해주세요.</p>
              )}
            </div>
          )}

          {/* Website URL */}
          {uploadType === "url" && (
            <div>
              <Label htmlFor="website-url" className="text-sm font-medium text-gray-700">
                웹사이트 URL
              </Label>
              <Input
                id="website-url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
                className="mt-1"
              />
              {url && !isValidUrl(url) && (
                <p className="text-xs text-red-600 mt-1">올바른 URL을 입력해주세요.</p>
              )}
            </div>
          )}
        </div>

        <div className="flex space-x-3 mt-6">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            className="flex-1"
          >
            취소
          </Button>
          <Button
            onClick={() => uploadMutation.mutate()}
            disabled={!canSubmit() || uploadMutation.isPending}
            className="flex-1"
          >
            {uploadMutation.isPending ? "업로드 중..." : "업로드"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
