import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import * as ftp from 'basic-ftp';

export interface ProcessedImageResult {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  width?: number;
  height?: number;
}

export interface UploadResult {
  filename: string;
  url: string;
  storageMode: 'http_api' | 'ftp' | 'local';
  optimizedSizeKB: number;
}

export class UploadService {
  private mode: string;
  private mediaPublicUrl: string;
  private localUploadDir: string;
  private uploadApiKey: string;
  private uploadApiEndpoint: string;

  constructor() {
    this.mode = process.env.STORAGE_MODE || 'local';
    this.mediaPublicUrl = process.env.MEDIA_PUBLIC_URL || 'https://media.congtc145.id.vn';
    this.uploadApiKey = process.env.INET_UPLOAD_SECRET_KEY || '';
    this.uploadApiEndpoint = process.env.INET_UPLOAD_ENDPOINT || '';
    this.localUploadDir = path.join(process.cwd(), 'uploads');

    if (!fs.existsSync(this.localUploadDir)) {
      fs.mkdirSync(this.localUploadDir, { recursive: true });
    }
  }

  /**
   * Trình xử lý và đồng nhất hình ảnh trước khi lưu trữ
   * - Chuẩn hóa tỷ lệ theo từng danh mục (tránh biến dạng)
   * - Nén tối ưu dung lượng và chuyển định dạng sang WebP
   * - Chuẩn hóa tên file an toàn
   */
  async processImage(file: Express.Multer.File, subFolder: string = 'cameras'): Promise<ProcessedImageResult> {
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const safeFilename = `${subFolder}_${timestamp}_${randomSuffix}.webp`;

    let sharpPipeline = sharp(file.buffer);

    // Tùy biến chuẩn hóa tỷ lệ theo thư mục
    if (subFolder === 'cameras') {
      // Ảnh sản phẩm: Chuẩn hóa tỉ lệ 4:3 (1200x900px), tự động căn giữa không bị méo
      sharpPipeline = sharpPipeline.resize({
        width: 1200,
        height: 900,
        fit: 'cover',
        position: 'center'
      });
    } else if (subFolder === 'passports') {
      // Ảnh kiểm định / vết trầy xước: Giữ nguyên chi tiết, giới hạn chiều rộng tối đa 1600px
      sharpPipeline = sharpPipeline.resize({
        width: 1600,
        withoutEnlargement: true,
        fit: 'inside'
      });
    } else if (subFolder === 'users') {
      // Ảnh avatar / CCCD: Giới hạn 800px
      sharpPipeline = sharpPipeline.resize({
        width: 800,
        withoutEnlargement: true,
        fit: 'inside'
      });
    }

    // Chuyển đổi sang WebP chất lượng 85% (giảm dung lượng ~80% mà cực kỳ sắc nét)
    const processedBuffer = await sharpPipeline
      .webp({ quality: 85, effort: 4 })
      .toBuffer();

    const metadata = await sharp(processedBuffer).metadata();

    return {
      buffer: processedBuffer,
      filename: safeFilename,
      mimeType: 'image/webp',
      width: metadata.width,
      height: metadata.height
    };
  }

  /**
   * Tải ảnh lên Hosting iNet (hỗ trợ HTTP API PHP hoặc FTP hoặc lưu cục bộ)
   */
  async uploadFile(file: Express.Multer.File, subFolder: string = 'cameras'): Promise<UploadResult> {
    // 1. Đồng nhất và nén ảnh qua Sharp trước
    const processed = await this.processImage(file, subFolder);
    const sizeKB = Math.round(processed.buffer.length / 1024);

    // 2. Phương án A: Tải qua HTTP API (api_upload.php trên hosting iNet)
    if (this.mode === 'http_api' && this.uploadApiEndpoint && this.uploadApiKey) {
      try {
        const formData = new FormData();
        const blob = new Blob([processed.buffer], { type: 'image/webp' });
        formData.append('file', blob, processed.filename);
        formData.append('folder', `filmiliar/${subFolder}`);

        const response = await fetch(this.uploadApiEndpoint, {
          method: 'POST',
          headers: {
            'X-Upload-Key': this.uploadApiKey
          },
          body: formData
        });

        if (response.ok) {
          const result = (await response.json()) as { success?: boolean; url?: string };
          if (result.success && result.url) {
            return {
              filename: processed.filename,
              url: result.url,
              storageMode: 'http_api',
              optimizedSizeKB: sizeKB
            };
          }
        } else {
          const errText = await response.text();
          console.warn('HTTP API upload returned error, falling back to local:', response.status, errText);
        }
      } catch (err) {
        console.error('HTTP API Upload failed, checking next method:', err);
      }
    }

    // 3. Phương án B: Tải qua FTP nếu có cấu hình FTP
    if (process.env.INET_FTP_HOST && process.env.INET_FTP_USER && process.env.INET_FTP_PASSWORD) {
      const client = new ftp.Client();
      try {
        await client.access({
          host: process.env.INET_FTP_HOST,
          port: Number(process.env.INET_FTP_PORT) || 21,
          user: process.env.INET_FTP_USER,
          password: process.env.INET_FTP_PASSWORD,
          secure: false
        });

        const remoteDir = path.posix.join(
          process.env.INET_FTP_REMOTE_DIR || '/public_html/filmiliar/uploads',
          subFolder
        );
        await client.ensureDir(remoteDir);

        const tempLocalPath = path.join(this.localUploadDir, processed.filename);
        fs.writeFileSync(tempLocalPath, processed.buffer);
        await client.uploadFrom(tempLocalPath, processed.filename);
        fs.unlinkSync(tempLocalPath);

        const publicUrl = `${this.mediaPublicUrl}/filmiliar/uploads/${subFolder}/${processed.filename}`;
        return {
          filename: processed.filename,
          url: publicUrl,
          storageMode: 'ftp',
          optimizedSizeKB: sizeKB
        };
      } catch (ftpError) {
        console.error('FTP Upload error:', ftpError);
      } finally {
        client.close();
      }
    }

    // 4. Phương án Dự phòng: Lưu cục bộ (cho môi trường dev)
    const targetFolder = path.join(this.localUploadDir, subFolder);
    if (!fs.existsSync(targetFolder)) {
      fs.mkdirSync(targetFolder, { recursive: true });
    }

    const localFilePath = path.join(targetFolder, processed.filename);
    fs.writeFileSync(localFilePath, processed.buffer);

    return {
      filename: processed.filename,
      url: `http://localhost:5000/uploads/${subFolder}/${processed.filename}`,
      storageMode: 'local',
      optimizedSizeKB: sizeKB
    };
  }
}

export const uploadService = new UploadService();
