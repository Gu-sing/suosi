import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

// 获取路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const membersSourceDir = path.join(rootDir, 'data/members');
const publicDir = path.join(rootDir, 'public');
const outputJsonPath = path.join(publicDir, 'members.json');
const outputAvatarDir = path.join(publicDir, 'avatars');

async function build() {
  console.log('🔄 开始构建数据...');
  
  // 1. 清理并重建 avatars 目录
  await fs.emptyDir(outputAvatarDir);
  
  // 2. 读取成员文件夹
  const items = await fs.readdir(membersSourceDir);
  const members = [];

  for (const folderName of items) {
    if (folderName.startsWith('.') || folderName === '_template') continue;

    const folderPath = path.join(membersSourceDir, folderName);
    const infoPath = path.join(folderPath, 'info.json');

    // 检查是否有 info.json
    if (!await fs.pathExists(infoPath)) continue;

    try {
      const info = await fs.readJson(infoPath);
      
      // 查找图片文件
      const files = await fs.readdir(folderPath);
      const imageFile = files.find(f => /\.(png|jpg|jpeg|webp)$/i.test(f));
      
      let avatarUrl = null;
      if (imageFile) {
        // 复制图片到 public/avatars/username.png
        const ext = path.extname(imageFile);
        const newFileName = `${folderName}${ext}`;
        await fs.copy(
          path.join(folderPath, imageFile),
          path.join(outputAvatarDir, newFileName)
        );
        // 使用相对路径，以便在不同 base 路径下都能正常工作
        avatarUrl = `avatars/${newFileName}`;
      }

      members.push({
        id: folderName,
        ...info,
        avatarUrl: avatarUrl || null // 如果没图，前端可以用默认图
      });
      
    } catch (err) {
      console.error(`❌ 处理 ${folderName} 失败:`, err);
    }
  }

  // 3. 写入 members.json
  await fs.writeJson(outputJsonPath, members, { spaces: 2 });
  console.log(`✅ 成功生成 ${members.length} 名成员数据！`);
}

build();