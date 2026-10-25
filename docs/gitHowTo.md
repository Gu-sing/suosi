## A simple git tutorial for Club Check-in By wdlin

在文档[底部](#example)，有一份Git打卡示例。

### 1. 配置Git

```bash
git config --global user.name "你的名字"
git config --global user.email "你的邮箱"
```

除此之外，你可能需要配置Github的ssh链接，可以看[教程](https://blog.csdn.net/weixin_42310154/article/details/118340458).

### 2. Fork 本仓库

**这是第一步！**

在 Github 页面右上角点击 **Fork** 按钮，将本仓库复制一份到你自己的账号下。

这样你就有了一个完全属于你的仓库副本，你可以随意修改而不会影响原仓库。

### 3. 克隆你的仓库

注意：这里克隆的是**你 Fork 出来的仓库**，而不是社团的原仓库。

```bash
git clone 你的仓库地址(在你的Github页面上复制)
```

### 4. 创建分支

虽然在自己的仓库里可以直接在主分支开发，但为了保持良好的习惯，建议为你的打卡创建一个新分支：

```bash
git checkout -b 你的名字
```

### 5. 添加个人信息

这是本次打卡的主要任务：
1. 在 `data/members/` 目录下创建一个以你的名字（或ID）命名的文件夹。
2. 复制 `_template` 目录下的内容到你的文件夹中。
3. 修改 `info.json`，填入你的信息。
4. 同时添加个人头像图片。

这一部分可以参考其他成员是怎么做的，`social` 部分如果你还没有个人博客，可以先不填写。

另外，`name` 字段不一定要填写真实姓名，不过如果你乐意，当然也可以:-)

### 6. 提交更改

在进行代码修改后，添加更改并提交：
```bash
git add .
git commit -m "add member: 你的名字"
```

`commit` 意味着将之前 `add` 选中的文件提交，提交信息是给自己看的，一般来说会描述本次提交做了什么。

### 7. 推送分支
将你的分支推送到**你的**远程仓库（Fork出来的那个）：
```bash
git push origin 你的名字
```

> Q: 什么是`origin`？
> A: 在这里，`origin` 指向的是你 Fork 出来的那个仓库。

### 8. 提交 Pull Request (PR)
1. 打开 Github 页面（你的仓库或原仓库均可）。
2. 你通常会看到一个黄色的提示框 "Compare & pull request"。
3. 如果没有，点击 "Pull requests" -> "New pull request"。
4. 确保左边是 **原仓库的 main 分支**，右边是 **你的仓库的 你的名字 分支**。
5. 点击 "Create pull request"，写点骚话，然后提交。
6. 等待管理员审核合并（Merge）。

### 9. (进阶) 同步原仓库更改
如果原仓库有了更新（比如别人已经打卡成功了），你需要同步到你的 Fork 仓库，以避免冲突：

```bash
# 1. 添加原仓库作为 upstream (只需要做一次)
git remote add upstream 原仓库地址

# 2. 拉取 upstream 的更新
git fetch upstream

# 3. 切换到主分支并合并
git checkout main
git merge upstream/main

# 4. 如果你在开发分支，也可以合并主分支的更新
git checkout 你的名字
git merge main
```

<a id="example"></a>

### 10.示例

#### Step 1

首先配置好`git config`。
然后在 Github 页面右上角点击 **Fork**。

#### Step 2

Clone **你的**仓库
```bash
git clone git@github.com:你的用户名/2025-registration.git
```

#### Step 3

创建一个新分支
```bash
git checkout -b wdlin
```

#### Step 4

复制 `data/members/_template` 到 `data/members/wdlin`。
修改 `data/members/wdlin/info.json` 中的内容。

#### Step 5

提交更改
```bash
git add data/members/wdlin
git commit -m "add member wdlin"
```

#### Step 6

推送分支
```bash
git push origin wdlin
```

#### Step 7

去 Github 页面点击 **Compare & pull request**，提交 PR。

#### Tips

- 记得先 Fork 再 Clone。
- 提交 PR 后，如果管理员要求修改，你只需要在本地继续修改、commit、push，PR 会自动更新。
- 遇到冲突不要慌，按照 Git 提示手动修改文件，然后再次 add 和 commit。

如果有任何使用上的问题，无论是我遇到的还是没遇到的，请联系我。