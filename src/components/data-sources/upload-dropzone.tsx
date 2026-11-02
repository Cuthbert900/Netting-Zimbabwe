'use client';

import * as React from 'react';
import { UploadCloudIcon, Loader2Icon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UploadDropzoneProps {
  onFiles: (files: File[]) => void;
  isBusy?: boolean;
  accentClassName?: string;
}

const ACCEPTED_EXTENSIONS = ['.csv', '.xlsx', '.xls'];

export function UploadDropzone({
  onFiles,
  isBusy,
  accentClassName,
}: UploadDropzoneProps) {
  const [isDragging, setIsDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList).filter((f) =>
      ACCEPTED_EXTENSIONS.some((ext) => f.name.toLowerCase().endsWith(ext))
    );
    if (files.length > 0) onFiles(files);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) =>
        (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()
      }
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        handleFiles(e.dataTransfer.files);
      }}
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-input bg-muted/30 px-4 py-8 text-center transition-colors hover:border-primary/50 hover:bg-muted/60',
        isDragging && 'border-primary bg-primary/5',
        accentClassName
      )}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".csv,.xlsx,.xls"
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = '';
        }}
      />
      {isBusy ? (
        <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
      ) : (
        <UploadCloudIcon className="size-6 text-muted-foreground" />
      )}
      <div className="text-sm font-medium">
        {isBusy ? 'Parsing extract…' : 'Drop CSV or XLSX, or click to browse'}
      </div>
      <div className="text-xs text-muted-foreground">
        .csv, .xlsx, .xls — parsed locally in your browser
      </div>
    </div>
  );
}
