import { describe, it, expect, vi, beforeEach } from 'vitest';
import { replaceGitHubImagesInMarkdown } from '../server/image-sync';

// Mock node-appwrite and config
vi.mock('@/config', () => ({
  IMAGES_BUCKET_ID: 'test-images-bucket',
}));

vi.mock('node-appwrite/file', () => ({
  InputFile: {
    fromBuffer: vi.fn().mockReturnValue({ name: 'test-file' }),
  },
}));

vi.mock('node-appwrite', () => ({
  ID: {
    unique: vi.fn().mockReturnValue('mock-id-123'),
  },
}));

describe('replaceGitHubImagesInMarkdown', () => {
  let mockStorage: { createFile: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage = {
      createFile: vi.fn().mockResolvedValue({ $id: 'uploaded-file-id' }),
    };

    // Mock global fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        get: (key: string) => {
          if (key.toLowerCase() === 'content-type') return 'image/png';
          return null;
        },
      },
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(10)),
    });
  });

  it('should pass through normal markdown text without changes', async () => {
    const input = 'This is a normal paragraph with no images.';
    const output = await replaceGitHubImagesInMarkdown(input, 'token', mockStorage);
    expect(output).toBe(input);
  });

  it('should detect private github issue assets and replace them with local proxy URLs', async () => {
    const input = 'Here is the bug screenshot:\n![screenshot](https://github.com/user-attachments/assets/7c4f42f5-b286-4f4a-9ef8-0245a49c693a)\nPlease fix it.';
    
    // Set NEXT_PUBLIC_APP_URL
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';

    const output = await replaceGitHubImagesInMarkdown(input, 'token', mockStorage);

    expect(global.fetch).toHaveBeenCalledWith(
      'https://github.com/user-attachments/assets/7c4f42f5-b286-4f4a-9ef8-0245a49c693a',
      expect.objectContaining({
        headers: { Authorization: 'Bearer token' },
      })
    );
    expect(mockStorage.createFile).toHaveBeenCalled();
    expect(output).toContain('http://localhost:3000/api/storage/images/mock-id-123');
    expect(output).not.toContain('https://github.com/user-attachments/assets/');
  });

  it('should follow redirects manually without leaking token', async () => {
    // Mock redirects: first call returns 302 redirect, second returns image
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        status: 302,
        headers: {
          get: (key: string) => {
            if (key.toLowerCase() === 'location') return 'https://s3.amazonaws.com/github-production/asset.png';
            return null;
          },
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: (key: string) => {
            if (key.toLowerCase() === 'content-type') return 'image/jpeg';
            return null;
          },
        },
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(10)),
      });

    const input = '![test](https://private-user-images.githubusercontent.com/123/asset.png)';
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';

    const output = await replaceGitHubImagesInMarkdown(input, 'token', mockStorage);

    expect(global.fetch).toHaveBeenCalledTimes(2);
    // First call has token
    expect(vi.mocked(global.fetch).mock.calls[0][0]).toBe('https://private-user-images.githubusercontent.com/123/asset.png');
    expect(vi.mocked(global.fetch).mock.calls[0][1]?.headers).toEqual({ Authorization: 'Bearer token' });

    // Second call (redirect) does NOT have token
    expect(vi.mocked(global.fetch).mock.calls[1][0]).toBe('https://s3.amazonaws.com/github-production/asset.png');
    expect(vi.mocked(global.fetch).mock.calls[1][1]?.headers).toBeUndefined();

    expect(output).toContain('http://localhost:3000/api/storage/images/mock-id-123');
  });
});
