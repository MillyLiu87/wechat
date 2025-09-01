<script setup lang="ts">
import axios from 'axios'
import {
  ChevronDownIcon,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Sun,
} from 'lucide-vue-next'
import { wechatCredentials } from '@/config/wechat-credentials'
import { altSign, ctrlKey, ctrlSign, shiftSign } from '@/configs/shortcut-key'
import { useStore } from '@/stores'
import { addPrefix, processClipboardContent } from '@/utils'

const emit = defineEmits([`startCopy`, `endCopy`])

const store = useStore()

const {
  isDark,
  isCiteStatus,
  isCountStatus,
  output,
  primaryColor,
  isOpenPostSlider,
  editor,
} = storeToRefs(store)

const {
  toggleDark,
  editorRefresh,
  citeStatusChanged,
  countStatusChanged,
  formatContent,
} = store

// ===== 封面图选择 =====
const coverFile = ref<File | null>(null)
const coverInputRef = ref<HTMLInputElement | null>(null)
const coverPreviewUrl = ref<string | null>(null)
const isUploading = ref(false)

// ===== 文章配置 =====
const showConfigDialog = ref(false)
const articleConfig = ref({
  title: '',
  author: '',
  digest: '',
  contentSourceUrl: '',
  showCoverPic: true,
  needOpenComment: false,
  onlyFansCanComment: false
})

function onCoverChange(e: Event) {
  const files = (e.target as HTMLInputElement).files
  coverFile.value = files && files[0] ? files[0] : null
  
  // 清理之前的预览URL
  if (coverPreviewUrl.value) {
    URL.revokeObjectURL(coverPreviewUrl.value)
    coverPreviewUrl.value = null
  }
  
  if (coverFile.value) {
    console.log('✅ 已选择封面：', coverFile.value.name)
    // 创建预览URL
    coverPreviewUrl.value = URL.createObjectURL(coverFile.value)
  }
}

function triggerPickCover() {
  coverInputRef.value?.click()
}

function deleteCover() {
  if (coverPreviewUrl.value) {
    URL.revokeObjectURL(coverPreviewUrl.value)
  }
  coverFile.value = null
  coverPreviewUrl.value = null
  // Reset the file input
  if (coverInputRef.value) {
    coverInputRef.value.value = ''
  }
}

function showCoverPreview() {
  if (coverPreviewUrl.value) {
    showCoverPreviewModal.value = true
  }
}

function closeCoverPreview() {
  showCoverPreviewModal.value = false
}

// Add a separate variable for preview modal visibility
const showCoverPreviewModal = ref(false)

// 工具函数，添加格式
function addFormat(cmd: string) {
  ;(editor.value as any).options.extraKeys[cmd](editor.value)
}

const formatItems = [
  { label: `加粗`, kbd: [ctrlSign, `B`], cmd: `${ctrlKey}-B` },
  { label: `斜体`, kbd: [ctrlSign, `I`], cmd: `${ctrlKey}-I` },
  { label: `删除线`, kbd: [ctrlSign, `D`], cmd: `${ctrlKey}-D` },
  { label: `超链接`, kbd: [ctrlSign, `K`], cmd: `${ctrlKey}-K` },
  { label: `行内代码`, kbd: [ctrlSign, `E`], cmd: `${ctrlKey}-E` },
  { label: `标题`, kbd: [ctrlSign, `H`], cmd: `${ctrlKey}-H` },
  { label: `无序列表`, kbd: [ctrlSign, `U`], cmd: `${ctrlKey}-U` },
  { label: `有序列表`, kbd: [ctrlSign, `O`], cmd: `${ctrlKey}-O` },
  { label: `格式化`, kbd: [altSign, shiftSign, `F`], cmd: `formatContent` },
] as const

const copyMode = useStorage(addPrefix(`copyMode`), `txt`)

const { copy: copyContent } = useClipboard({
  legacy: true,
})

// ===== 共享的背景样式保留函数 =====
async function preserveBackgroundStyles(clipboardDiv: HTMLElement): Promise<void> {
  // 创建一个带有prose样式的临时容器来捕获完整样式
  const tempDiv = document.createElement('div')
  tempDiv.className = 'prose prose-sm max-w-none'
  tempDiv.innerHTML = clipboardDiv.innerHTML
  tempDiv.style.position = 'absolute'
  tempDiv.style.left = '-9999px'
  tempDiv.style.visibility = 'hidden'
  document.body.appendChild(tempDiv)
  
  try {
    // 等待样式应用
    await nextTick()
    
    // 递归内联背景和关键样式
    function inlineBackgroundStyles(element: Element) {
      const computed = window.getComputedStyle(element)
      const existing = element.getAttribute('style') || ''
      const styles: string[] = []
      
      // 重点处理背景相关样式
      const backgroundColor = computed.backgroundColor
      const backgroundImage = computed.backgroundImage
      
      if (backgroundColor && backgroundColor !== 'rgba(0, 0, 0, 0)' && backgroundColor !== 'transparent') {
        styles.push(`background-color: ${backgroundColor}`)
      }
      
      if (backgroundImage && backgroundImage !== 'none') {
        styles.push(`background-image: ${backgroundImage}`)
      }
      
      // 添加其他重要样式
      const color = computed.color
      if (color && color !== 'rgb(0, 0, 0)') {
        styles.push(`color: ${color}`)
      }
      
      const padding = computed.padding
      if (padding && padding !== '0px') {
        styles.push(`padding: ${padding}`)
      }
      
      const borderRadius = computed.borderRadius
      if (borderRadius && borderRadius !== '0px') {
        styles.push(`border-radius: ${borderRadius}`)
      }
      
      if (styles.length > 0) {
        const newStyle = existing ? `${existing}; ${styles.join('; ')}` : styles.join('; ')
        element.setAttribute('style', newStyle)
      }
      
      // 递归处理子元素
      Array.from(element.children).forEach(child => inlineBackgroundStyles(child))
    }
    
    // 应用内联样式
    inlineBackgroundStyles(tempDiv)
    
    // 将处理后的内容复制回原容器
    clipboardDiv.innerHTML = tempDiv.innerHTML
    
  } finally {
    // 清理临时容器
    document.body.removeChild(tempDiv)
  }
}

// 复制到微信公众号
async function copy() {
  // 如果是 Markdown 源码，直接复制并返回
  if (copyMode.value === `md`) {
    const mdContent = editor.value?.getValue() || ``
    await copyContent(mdContent)
    toast.success(`已复制 Markdown 源码到剪贴板。`)
    return
  }

  // 以下处理非 Markdown 的复制流程
  emit(`startCopy`)

  setTimeout(() => {
    // 如果是深色模式，复制之前需要先切换到白天模式
    const isBeforeDark = isDark.value
    if (isBeforeDark) {
      toggleDark()
    }

    nextTick(async () => {
      const clipboardDiv = document.getElementById(`output`)!
      
      // 保留背景样式（和发送功能使用相同逻辑）
      await preserveBackgroundStyles(clipboardDiv)
      
      processClipboardContent(primaryColor.value)
      clipboardDiv.focus()
      window.getSelection()!.removeAllRanges()

      const temp = clipboardDiv.innerHTML

      if (copyMode.value === `txt`) {
        const range = document.createRange()
        range.setStartBefore(clipboardDiv.firstChild!)
        range.setEndAfter(clipboardDiv.lastChild!)
        window.getSelection()!.addRange(range)
        document.execCommand(`copy`)
        window.getSelection()!.removeAllRanges()
      }

      clipboardDiv.innerHTML = output.value

      if (isBeforeDark) {
        nextTick(() => toggleDark())
      }

      if (copyMode.value === `html`) {
        await copyContent(temp)
      }
      else if (copyMode.value === `html-and-style`) {
        await copyContent(store.editorContent2HTML())
      }

      // 输出提示
      toast.success(
        copyMode.value === `html`
          ? `已复制 HTML 源码，请进行下一步操作。`
          : `已复制渲染后的内容到剪贴板，可直接到公众号后台粘贴。`,
      )
      window.dispatchEvent(
        new CustomEvent(`copyToMp`, {
          detail: { content: output.value },
        }),
      )
      editorRefresh()
      emit(`endCopy`)
    })
  }, 350)
}

// ===== 上传永久素材（封面）助手 =====
async function uploadPermanentImage(accessToken: string, file: File): Promise<string> {
  const form = new FormData()
  form.append('media', file)
  form.append('type', 'image')

  try {
    const response = await axios.post(
      `/cgi-bin/material/add_material?access_token=${accessToken}&type=image`,
      form,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 30000, // 30秒超时
      }
    )

    console.log('📸 上传封面响应:', response.data)

    if (response.data?.errcode && response.data.errcode !== 0) {
      throw new Error(`上传封面失败: ${response.data.errcode} - ${response.data.errmsg}`)
    }

    if (!response.data?.media_id) {
      throw new Error(`上传封面失败: 未返回 media_id`)
    }

    return response.data.media_id
  } catch (error: any) {
    console.error('❌ 上传封面失败:', error)
    if (error.response?.data) {
      throw new Error(`上传封面失败: ${error.response.data.errmsg || error.response.data.errcode || '未知错误'}`)
    }
    throw new Error(`上传封面失败: ${error.message}`)
  }
}

// ===== 获取预览面板内容的函数（确保背景样式被保留） =====
async function getPreviewContent(): Promise<string> {
  try {
    console.log('📄 开始获取预览内容（确保背景样式被保留）')
    
    const clipboardDiv = document.getElementById('output')
    if (!clipboardDiv) {
      console.error('❌ 找不到预览面板')
      return `<p>获取内容失败 - ${new Date().toLocaleString()}</p>`
    }

    // 保存原始内容和状态
    const originalContent = clipboardDiv.innerHTML
    const isBeforeDark = isDark.value
    
    try {
      // 如果是深色模式，先切换到白天模式（和复制逻辑完全一致）
      if (isBeforeDark) {
        toggleDark()
        await nextTick()
      }
      
      // 保留背景样式（使用共享函数）
      await preserveBackgroundStyles(clipboardDiv)
      
      // 使用和copy()相同的处理逻辑
      processClipboardContent(primaryColor.value)
      
      // 获取处理后的内容
      let styledContent = clipboardDiv.innerHTML
      
      // 恢复深色模式（如果之前是深色）
      if (isBeforeDark) {
        await nextTick()
        toggleDark()
      }
      
      console.log('📄 获取到带样式的内容，长度:', styledContent.length)
      console.log('📄 内容预览（前200字符）:', styledContent.substring(0, 200))
      
      return styledContent
      
    } finally {
      // 恢复原始内容（重要：确保预览面板不被破坏）
      clipboardDiv.innerHTML = originalContent
    }
    
  } catch (error) {
    console.error('❌ 获取预览内容失败:', error)
    return `<p>获取内容失败，使用默认内容 - ${new Date().toLocaleString()}</p>`
  }
}

// ===== 配置对话框 =====
function showArticleConfigDialog() {
  // 设置默认值
  if (!articleConfig.value.title) {
    articleConfig.value.title = `文章标题 - ${new Date().toLocaleString()}`
  }
  if (!articleConfig.value.author) {
    articleConfig.value.author = `小飞侠说AI`
  }
  if (!articleConfig.value.digest) {
    articleConfig.value.digest = `文章摘要 - 这是一篇通过编辑器发送的文章`
  }
  
  showConfigDialog.value = true
}

function closeConfigDialog() {
  showConfigDialog.value = false
}

async function confirmSendWithConfig() {
  showConfigDialog.value = false
  await actualSendToWeChat()
}

// ===== 预览即将发送的内容（包含封面上传） =====
const showPreviewDialog = ref(false)
const previewContent = ref('')

async function previewSendContent() {
  try {
    previewContent.value = await getPreviewContent()
    console.log('📝 即将发送的内容:', previewContent.value)
    showPreviewDialog.value = true
  } catch (error) {
    console.error('❌ 获取预览内容失败:', error)
    toast.error('获取预览内容失败')
  }
}

function closePreviewDialog() {
  showPreviewDialog.value = false
}

async function confirmSendFromPreview() {
  showPreviewDialog.value = false
  showArticleConfigDialog()
}

// ===== 发送到公众号（创建草稿）=====
async function onNewButtonClick() {
  if (isUploading.value) {
    toast.warning('正在上传中，请稍候...')
    return
  }

  // 验证配置
  if (!wechatCredentials.appId || !wechatCredentials.appSecret) {
    toast.error(`请先在 wechat-credentials.ts 中配置 appId 和 appSecret`)
    return
  }

  // 直接进入预览流程，封面图会在预览对话框中处理
  await previewSendContent()
}

async function actualSendToWeChat() {
  try {
    isUploading.value = true
    
    // 验证封面图（在实际发送时检查）
    if (!coverFile.value) {
      toast.error('请先选择封面图')
      isUploading.value = false
      return
    }
    
    // 获取预览面板的内容（现在不会破坏预览面板）
    const previewContent = await getPreviewContent()
    console.log('📝 准备发送的内容长度:', previewContent.length)
    console.log('📝 内容预览（前500字符）:', previewContent.substring(0, 500))

    toast.info('正在获取访问令牌...')

    // 1) 获取 access_token - 使用本地代理避免CORS问题
    const tokenResp = await axios.get(`/cgi-bin/token`, {
      params: {
        grant_type: `client_credential`,
        appid: wechatCredentials.appId,
        secret: wechatCredentials.appSecret,
      },
      timeout: 10000,
    })

    console.log('🔑 Token Response:', tokenResp.data)

    if (tokenResp.data?.errcode && tokenResp.data.errcode !== 0) {
      throw new Error(`获取访问令牌失败: ${tokenResp.data.errcode} - ${tokenResp.data.errmsg}`)
    }

    const accessToken = tokenResp.data?.access_token
    if (!accessToken) {
      throw new Error(`获取访问令牌失败: 响应中没有 access_token`)
    }

    toast.info('正在上传封面图...')

    // 2) 上传封面为【永久素材】得到 media_id
    const thumbMediaId = await uploadPermanentImage(accessToken, coverFile.value)
    console.log('🖼️ 封面上传成功，media_id:', thumbMediaId)

    toast.info('正在创建草稿...')

    // 3) 调用 draft/add 创建草稿
    const draftData = {
      articles: [
        {
          title: articleConfig.value.title,
          author: articleConfig.value.author,
          digest: articleConfig.value.digest,
          content: previewContent, // 使用预览面板的实际渲染内容
          content_source_url: articleConfig.value.contentSourceUrl || '', // 原文链接，可选
          thumb_media_id: thumbMediaId, // 封面图的永久素材ID
          show_cover_pic: 1, // 是否显示封面，1-显示（封面图已上传）
          need_open_comment: articleConfig.value.needOpenComment ? 1 : 0, // 是否打开评论，0-不打开，1-打开
          only_fans_can_comment: articleConfig.value.onlyFansCanComment ? 1 : 0, // 是否粉丝才可评论，0-所有人可评论，1-粉丝才可评论
        },
      ],
    }

    console.log('📝 准备创建草稿，数据:', draftData)

    const draftResp = await axios.post(
      `/cgi-bin/draft/add?access_token=${accessToken}`,
      draftData,
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    )

    console.log('📝 Draft Response:', draftResp.data)

    // 检查响应
    if (draftResp.data?.errcode && draftResp.data.errcode !== 0) {
      throw new Error(`创建草稿失败: ${draftResp.data.errcode} - ${draftResp.data.errmsg}`)
    }

    if (draftResp.data?.media_id) {
      toast.success(`🎉 草稿创建成功！\nmedia_id: ${draftResp.data.media_id}\n请前往微信公众号后台查看`)
    } else {
      console.warn('⚠️ 响应中没有media_id:', draftResp.data)
      toast.warning(`草稿可能创建成功，但响应异常。请检查公众号后台。`)
    }

  } catch (error: any) {
    console.error('❌ 发送到公众号失败:', error)
    
    let errorMessage = '发送失败: 未知错误'
    
    if (error.response?.data) {
      const { errcode, errmsg } = error.response.data
      errorMessage = `发送失败: ${errcode} - ${errmsg}`
    } else if (error.message) {
      errorMessage = `发送失败: ${error.message}`
    }
    
    // 根据错误类型给出特定提示
    if (error.code === 'NETWORK_ERROR' || error.message.includes('CORS')) {
      errorMessage += '\n\n提示: 请确保已正确配置代理服务器来解决CORS问题'
    } else if (error.message.includes('40001')) {
      errorMessage += '\n\n提示: access_token无效，请检查appId和appSecret配置'
    } else if (error.message.includes('40007')) {
      errorMessage += '\n\n提示: 请检查appId配置是否正确'
    }
    
    toast.error(errorMessage)
  } finally {
    isUploading.value = false
  }
}
</script>

<template>
  <header
    class="header-container h-15 flex flex-wrap items-center justify-between px-5 dark:bg-[#191c20]"
  >
    <!-- 左侧菜单：移动端隐藏 -->
    <div class="space-x-2 hidden sm:flex">
      <Menubar class="menubar">
        <FileDropdown />

        <MenubarMenu>
          <MenubarTrigger> 格式</MenubarTrigger>
          <MenubarContent class="w-60" align="start">
            <MenubarCheckboxItem
              v-for="{ label, kbd, cmd } in formatItems"
              :key="label"
              @click="cmd === 'formatContent' ? formatContent() : addFormat(cmd)"
            >
              {{ label }}
              <MenubarShortcut>
                <kbd
                  v-for="item in kbd"
                  :key="item"
                  class="mx-1 bg-gray-2 dark:bg-stone-9"
                >
                  {{ item }}
                </kbd>
              </MenubarShortcut>
            </MenubarCheckboxItem>
            <MenubarSeparator />
            <MenubarCheckboxItem
              :checked="isCiteStatus"
              @click="citeStatusChanged()"
            >
              微信外链转底部引用
            </MenubarCheckboxItem>
            <MenubarSeparator />
            <MenubarCheckboxItem
              :checked="isCountStatus"
              @click="countStatusChanged()"
            >
              统计字数和阅读时间
            </MenubarCheckboxItem>
          </MenubarContent>
        </MenubarMenu>
        <EditDropdown />
        <StyleDropdown />
        <HelpDropdown />
      </Menubar>
    </div>

    <!-- 右侧操作区：移动端保留核心按钮 -->
    <div class="space-x-2 flex flex-wrap">
      <!-- 展开/收起左侧内容栏 -->
      <Button
        variant="outline"
        size="icon"
        @click="isOpenPostSlider = !isOpenPostSlider"
      >
        <PanelLeftOpen v-show="!isOpenPostSlider" class="size-4" />
        <PanelLeftClose v-show="isOpenPostSlider" class="size-4" />
      </Button>

      <!-- 暗色切换 -->
      <Button variant="outline" size="icon" @click="toggleDark()">
        <Moon v-show="isDark" class="size-4" />
        <Sun v-show="!isDark" class="size-4" />
      </Button>

      <!-- 复制按钮组 -->
      <div
        class="bg-background space-x-1 text-background-foreground mx-2 flex items-center border rounded-md"
      >
        <Button variant="ghost" class="shadow-none" @click="copy">
          复制
        </Button>

        <Button 
          variant="ghost" 
          class="shadow-none" 
          @click="onNewButtonClick"
          :disabled="isUploading"
        >
          {{ isUploading ? '发送中...' : '发送到公众号' }}
        </Button>

        <Separator orientation="vertical" class="h-5" />
        <DropdownMenu v-model="copyMode">
          <DropdownMenuTrigger as-child>
            <Button variant="ghost" class="px-2 shadow-none">
              <ChevronDownIcon class="text-secondary-foreground h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" :align-offset="-5" class="w-[200px]">
            <DropdownMenuRadioGroup v-model="copyMode">
              <DropdownMenuRadioItem value="txt">
                公众号格式
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="html">
                HTML 格式
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="html-and-style">
                HTML 格式（兼容样式）
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="md">
                MD 格式
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <!-- 文章信息（移动端隐藏） -->
      <PostInfo class="hidden sm:inline-flex" />

      <!-- 设置按钮 -->
      <Button
        variant="outline"
        size="icon"
        @click="store.isOpenRightSlider = !store.isOpenRightSlider"
      >
        <Settings class="size-4" />
      </Button>
    </div>
  </header>

  <!-- 文章配置对话框 -->
  <div 
    v-if="showConfigDialog" 
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    @click="closeConfigDialog"
  >
    <div class="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4 max-h-[80vh] overflow-y-auto" @click.stop>
      <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-white">配置文章信息</h3>
      
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">文章标题</label>
          <input 
            v-model="articleConfig.title"
            type="text" 
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            placeholder="请输入文章标题"
            @click.stop
          />
        </div>

        <div>
          <label class="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">作者</label>
          <input 
            v-model="articleConfig.author"
            type="text" 
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            placeholder="请输入作者名称"
            @click.stop
          />
        </div>

        <div>
          <label class="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">文章摘要</label>
          <textarea 
            v-model="articleConfig.digest"
            rows="3"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            placeholder="请输入文章摘要"
            @click.stop
          ></textarea>
        </div>

        <div>
          <label class="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">原文链接 (可选)</label>
          <input 
            v-model="articleConfig.contentSourceUrl"
            type="url" 
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            placeholder="请输入原文链接"
            @click.stop
          />
        </div>

        <div class="space-y-2">
          <div class="flex items-center">
            <input 
              v-model="articleConfig.needOpenComment"
              type="checkbox" 
              id="needOpenComment"
              class="mr-2"
              @click.stop
            />
            <label for="needOpenComment" class="text-sm text-gray-700 dark:text-gray-300">开启评论</label>
          </div>

          <div class="flex items-center">
            <input 
              v-model="articleConfig.onlyFansCanComment"
              type="checkbox" 
              id="onlyFansCanComment"
              class="mr-2"
              :disabled="!articleConfig.needOpenComment"
              @click.stop
            />
            <label for="onlyFansCanComment" class="text-sm text-gray-700 dark:text-gray-300">仅粉丝可评论</label>
          </div>
        </div>
      </div>

      <div class="flex justify-end space-x-3 mt-6">
        <Button variant="outline" @click="closeConfigDialog">
          取消
        </Button>
        <Button @click="confirmSendWithConfig" :disabled="!articleConfig.title.trim()">
          确认发送
        </Button>
      </div>
    </div>
  </div>

  <!-- 内容预览对话框（包含封面上传） -->
  <div 
    v-if="showPreviewDialog" 
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    @click="closePreviewDialog"
  >
    <div class="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-6xl mx-4 max-h-[90vh] overflow-y-auto" @click.stop>
      <h3 class="text-xl font-semibold mb-6 text-gray-900 dark:text-white">即将发送到微信公众号的内容预览</h3>
      
      <div class="flex gap-6 min-h-0">
        <!-- 左侧封面图区域 -->
        <div class="flex-0 w-80">
          <h4 class="text-sm font-medium mb-3 text-gray-700 dark:text-gray-300">封面图设置</h4>
          
          <!-- 封面图上传 -->
          <div class="mb-4">
            <input
              ref="coverInputRef"
              type="file"
              accept="image/jpeg,image/png,image/gif"
              class="hidden"
              @change="onCoverChange"
            />
            
            <div 
              v-if="!coverPreviewUrl"
              class="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400"
              @click="triggerPickCover"
            >
              <div class="text-gray-500 dark:text-gray-400">
                <svg class="w-12 h-12 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                </svg>
                <p class="text-sm">点击上传封面图</p>
                <p class="text-xs text-gray-400 mt-1">支持 JPG、PNG、GIF 格式</p>
              </div>
            </div>
            
            <div v-else class="relative">
              <img 
                :src="coverPreviewUrl" 
                alt="封面预览" 
                class="w-full max-h-48 object-cover rounded-lg border"
              />
              <div class="absolute top-2 right-2 flex gap-2">
                <button
                  @click="triggerPickCover"
                  class="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600"
                >
                  重新选择
                </button>
                <button
                  @click="deleteCover"
                  class="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600"
                >
                  删除
                </button>
              </div>
            </div>
          </div>
          
          <!-- 封面图信息 -->
          <div v-if="coverFile" class="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-3 rounded">
            <p><strong>文件名:</strong> {{ coverFile.name }}</p>
            <p><strong>大小:</strong> {{ (coverFile.size / 1024).toFixed(1) }} KB</p>
            <p><strong>类型:</strong> {{ coverFile.type }}</p>
          </div>
        </div>
        
        <!-- 右侧文章内容预览 -->
        <div class="flex-1 min-w-0">
          <h4 class="text-sm font-medium mb-3 text-gray-700 dark:text-gray-300">文章内容预览</h4>
          <div class="border border-gray-300 dark:border-gray-600 rounded-lg p-4 max-h-96 overflow-y-auto bg-gray-50 dark:bg-gray-700">
            <div v-html="previewContent" class="prose prose-sm max-w-none"></div>
          </div>
        </div>
      </div>
      
      <div class="flex justify-between items-center mt-6 pt-4 border-t border-gray-200 dark:border-gray-600">
        <div class="text-sm text-gray-500">
          <span v-if="!coverFile" class="text-yellow-600">⚠️ 建议上传封面图以获得更好的展示效果</span>
          <span v-else class="text-green-600">✅ 封面图已准备就绪</span>
        </div>
        <div class="flex gap-3">
          <Button variant="outline" @click="closePreviewDialog">
            取消
          </Button>
          <Button @click="confirmSendFromPreview">
            下一步：配置文章信息
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="less" scoped>
.menubar {
  user-select: none;
}

kbd {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  border: 1px solid #a8a8a8;
  padding: 1px 4px;
  border-radius: 2px;
}
</style>