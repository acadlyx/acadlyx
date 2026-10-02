export type StorageResourceType = "image" | "video" | "raw" | "auto";
export type StorageVisibility = "public" | "private";

export interface StorageUploadInput {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  folder: string;
  resourceType?: StorageResourceType;
  visibility?: StorageVisibility;
  overwrite?: boolean;
  publicId?: string;
}

export interface StorageObject {
  provider: string;
  publicId: string;
  url: string;
  secureUrl: string;
  resourceType: string;
  mimeType: string;
  bytes: number;
  folder: string;
  visibility: StorageVisibility;
  format?: string;
  version?: number;
}

export interface FileStorageProvider {
  upload(input: StorageUploadInput): Promise<StorageObject>;
  delete(input: { publicId: string; resourceType?: string }): Promise<void>;
  getDeliveryUrl(input: {
    publicId: string;
    resourceType?: string;
    visibility?: StorageVisibility;
    download?: boolean;
  }): string;
}
