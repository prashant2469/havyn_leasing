"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createListingPhotoAction,
  deleteListingPhotoAction,
  reorderListingPhotosAction,
  setPrimaryPhotoAction,
  updatePhotoCaptionAction,
} from "@/server/actions/photos";

type ListingPhotoItem = {
  id: string;
  caption: string | null;
  sortOrder: number;
  isPrimary: boolean;
  url: string | null;
};

type Props = {
  listingId: string;
  photos: ListingPhotoItem[];
};

type PresignResponse = {
  uploadUrl: string;
  storageKey: string;
};

export function PhotoUploadPanel({ listingId, photos }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [dragPhotoId, setDragPhotoId] = useState<string | null>(null);
  const [uploading, startUploadTransition] = useTransition();
  const [mutating, startMutationTransition] = useTransition();

  const orderedPhotos = useMemo(
    () => [...photos].sort((a, b) => a.sortOrder - b.sortOrder),
    [photos],
  );

  async function uploadSingleFile(file: File): Promise<void> {
    const presignResp = await fetch("/api/uploads/presign", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        listingId,
        filename: file.name,
        contentType: file.type || "application/octet-stream",
      }),
    });
    const presign = (await presignResp.json()) as PresignResponse | { error: string };
    if (!presignResp.ok || !("uploadUrl" in presign)) {
      throw new Error("Unable to create upload URL.");
    }

    const putResp = await fetch(presign.uploadUrl, {
      method: "PUT",
      headers: { "content-type": file.type || "application/octet-stream" },
      body: file,
    });
    if (!putResp.ok) throw new Error("Upload failed.");

    const payload = new FormData();
    payload.set("listingId", listingId);
    payload.set("storageKey", presign.storageKey);
    payload.set("caption", "");
    const result = await createListingPhotoAction(null, payload);
    if (!result.ok) throw new Error(result.message);
  }

  function handleFileInput(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList).filter((file) => file.type.startsWith("image/"));
    if (files.length === 0) {
      setError("Please select at least one image file.");
      return;
    }

    setError(null);
    startUploadTransition(async () => {
      try {
        for (const file of files) {
          await uploadSingleFile(file);
        }
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed.");
      }
    });
  }

  function handleSetPrimary(photoId: string) {
    setError(null);
    startMutationTransition(async () => {
      const payload = new FormData();
      payload.set("listingId", listingId);
      payload.set("photoId", photoId);
      const result = await setPrimaryPhotoAction(null, payload);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
    });
  }

  function handleDelete(photoId: string) {
    setError(null);
    startMutationTransition(async () => {
      const payload = new FormData();
      payload.set("listingId", listingId);
      payload.set("photoId", photoId);
      const result = await deleteListingPhotoAction(null, payload);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
    });
  }

  function handleCaptionSave(photoId: string, caption: string) {
    setError(null);
    startMutationTransition(async () => {
      const payload = new FormData();
      payload.set("listingId", listingId);
      payload.set("photoId", photoId);
      payload.set("caption", caption);
      const result = await updatePhotoCaptionAction(null, payload);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
    });
  }

  function handleDrop(targetPhotoId: string) {
    if (!dragPhotoId || dragPhotoId === targetPhotoId) return;
    const fromIndex = orderedPhotos.findIndex((photo) => photo.id === dragPhotoId);
    const toIndex = orderedPhotos.findIndex((photo) => photo.id === targetPhotoId);
    if (fromIndex < 0 || toIndex < 0) return;

    const next = [...orderedPhotos];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);

    setError(null);
    startMutationTransition(async () => {
      const payload = new FormData();
      payload.set("listingId", listingId);
      payload.set("photoIds", JSON.stringify(next.map((photo) => photo.id)));
      const result = await reorderListingPhotosAction(null, payload);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <label htmlFor="listing-photo-upload" className="text-sm font-medium">
          Upload photos
        </label>
        <Input
          id="listing-photo-upload"
          type="file"
          accept="image/*"
          multiple
          disabled={uploading || mutating}
          onChange={(event) => handleFileInput(event.target.files)}
        />
        <p className="text-muted-foreground text-xs">
          Upload images, drag rows to reorder, and mark one image as primary.
        </p>
      </div>

      {orderedPhotos.length === 0 ? (
        <p className="text-muted-foreground text-sm">No photo rows yet.</p>
      ) : (
        <ul className="space-y-2">
          {orderedPhotos.map((photo) => (
            <li
              key={photo.id}
              draggable
              onDragStart={() => setDragPhotoId(photo.id)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => handleDrop(photo.id)}
              className="bg-muted/30 flex items-center gap-3 rounded-md border p-2"
            >
              {photo.url ? (
                <div className="relative h-16 w-24 overflow-hidden rounded">
                  <Image
                    src={photo.url}
                    alt={photo.caption ?? "Listing photo"}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
              ) : (
                <div className="bg-muted text-muted-foreground flex h-16 w-24 items-center justify-center rounded text-xs">
                  No URL
                </div>
              )}
              <div className="flex-1 space-y-2">
                <Input
                  defaultValue={photo.caption ?? ""}
                  placeholder="Add caption"
                  onBlur={(event) => handleCaptionSave(photo.id, event.target.value)}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="xs"
                    variant={photo.isPrimary ? "default" : "outline"}
                    disabled={uploading || mutating}
                    onClick={() => handleSetPrimary(photo.id)}
                  >
                    {photo.isPrimary ? "Primary" : "Set primary"}
                  </Button>
                  <Button
                    type="button"
                    size="xs"
                    variant="destructive"
                    disabled={uploading || mutating}
                    onClick={() => handleDelete(photo.id)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {error ? <p className="text-destructive text-xs">{error}</p> : null}
      {(uploading || mutating) ? <p className="text-muted-foreground text-xs">Saving changes...</p> : null}
    </div>
  );
}
