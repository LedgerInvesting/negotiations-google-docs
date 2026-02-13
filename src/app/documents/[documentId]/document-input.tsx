"use client";

import { useRef, useState } from "react";
import { BsCloudCheck } from "react-icons/bs";
import { useDebounce } from "@/hooks/use-debounce";
import { toast } from "sonner";
import { LoaderIcon } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { apiClient } from "@/lib/api-client";

interface DocumentInputProps {
  title: string;
  id: number;
}

export const DocumentInput = ({ title, id }: DocumentInputProps) => {
  const { getToken } = useAuth();

  const [value, setValue] = useState(title);
  const [isPending, setIsPending] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  const debouncedUpdate = useDebounce(async (newValue: string) => {
    if (newValue === title) return;

    setIsPending(true);
    try {
      const token = await getToken();
      await apiClient.updateDocument(token, id, { title: newValue });
      toast.success("Document updated");
    } catch (error) {
      toast.error("Something went wrong");
    } finally {
      setIsPending(false);
    }
  });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setIsPending(true);
    try {
      const token = await getToken();
      await apiClient.updateDocument(token, id, { title: value });
      toast.success("Document updated");
      setIsEditing(false);
    } catch (error) {
      toast.error("Something went wrong");
    } finally {
      setIsPending(false);
    }
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    debouncedUpdate(newValue);
  };

  const showLoader = isPending;

  return (
    <div className="flex items-center gap-2">
      {isEditing ? (
        <form onSubmit={handleSubmit} className="relative w-fit max-w-[50ch]">
          <span className="invisible whitespace-pre px-1.5 text-lg">{value || " "}</span>
          <input
            ref={inputRef}
            value={value}
            onChange={onChange}
            onBlur={() => setIsEditing(false)}
            className="absolute inset-0 text-lg text-black px-1.5 bg-transparent truncate"
          />
        </form>
      ) : (
        <span
          onClick={() => {
            setIsEditing(true);
            setTimeout(() => {
              inputRef.current?.focus();
            }, 0);
          }}
          className="text-lg px-1.5 cursor-pointer truncate"
        >
          {title}
        </span>
      )}
      {!showLoader && <BsCloudCheck className="size-4" />}
      {showLoader && <LoaderIcon className="size-4 animate-spin text-muted-foreground" />}
    </div>
  );
};
