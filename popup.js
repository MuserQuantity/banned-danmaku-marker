// popup.js - 弹幕记录查看界面脚本

let allDanmakus = [];
let filteredDanmakus = [];

// DOM元素
const roomFilter = document.getElementById('roomFilter');
const searchInput = document.getElementById('searchInput');
const content = document.getElementById('content');
const totalCount = document.getElementById('totalCount');
const refreshBtn = document.getElementById('refreshBtn');
const exportBtn = document.getElementById('exportBtn');
const clearBtn = document.getElementById('clearBtn');

// 初始化
document.addEventListener('DOMContentLoaded', function() {
  loadDanmakus();
  
  // 绑定事件
  roomFilter.addEventListener('change', applyFilters);
  searchInput.addEventListener('input', applyFilters);
  refreshBtn.addEventListener('click', loadDanmakus);
  exportBtn.addEventListener('click', exportData);
  clearBtn.addEventListener('click', clearAllData);
});

// 加载弹幕数据
async function loadDanmakus() {
  try {
    const result = await chrome.storage.local.get(['bannedDanmakus']);
    allDanmakus = result.bannedDanmakus || [];
    
    // 按时间倒序排列（最新的在前面）
    allDanmakus.sort((a, b) => b.timestamp - a.timestamp);
    
    updateRoomFilter();
    applyFilters();
  } catch (error) {
    console.error('加载弹幕数据失败:', error);
    showError('加载数据失败');
  }
}

// 更新直播间筛选器
function updateRoomFilter() {
  // 获取所有独特的直播间
  const rooms = [...new Set(allDanmakus.map(item => item.roomId))]
    .map(roomId => {
      const danmaku = allDanmakus.find(item => item.roomId === roomId);
      return {
        roomId: roomId,
        upName: danmaku.upName,
        roomTitle: danmaku.roomTitle
      };
    });
  
  // 清空现有选项（保留"全部直播间"）
  roomFilter.innerHTML = '<option value="">全部直播间</option>';
  
  // 添加直播间选项
  rooms.forEach(room => {
    const option = document.createElement('option');
    option.value = room.roomId;
    option.textContent = `${room.upName} (${room.roomId})`;
    roomFilter.appendChild(option);
  });
}

// 应用筛选条件
function applyFilters() {
  const selectedRoom = roomFilter.value;
  const searchTerm = searchInput.value.toLowerCase().trim();
  
  filteredDanmakus = allDanmakus.filter(item => {
    // 直播间筛选
    if (selectedRoom && item.roomId !== selectedRoom) {
      return false;
    }
    
    // 内容搜索
    if (searchTerm && !item.content.toLowerCase().includes(searchTerm)) {
      return false;
    }
    
    return true;
  });
  
  renderDanmakus();
  updateStats();
}

// 渲染弹幕列表
function renderDanmakus() {
  if (filteredDanmakus.length === 0) {
    content.innerHTML = '<div class="empty-state">暂无匹配的弹幕记录</div>';
    return;
  }
  
  const html = filteredDanmakus.map(item => `
    <div class="danmaku-item">
      <div class="danmaku-content">${escapeHtml(item.content)}</div>
      <div class="danmaku-info">
        <div class="room-info" title="${escapeHtml(item.roomTitle)}">
          ${escapeHtml(item.upName)} · ${item.roomId}
        </div>
        <div class="time-info">${item.date}</div>
      </div>
    </div>
  `).join('');
  
  content.innerHTML = html;
}

// 更新统计信息
function updateStats() {
  totalCount.textContent = filteredDanmakus.length;
}

// 导出数据
function exportData() {
  if (filteredDanmakus.length === 0) {
    alert('没有数据可导出');
    return;
  }
  
  const csvContent = generateCSV(filteredDanmakus);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `被禁弹幕记录_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  
  URL.revokeObjectURL(url);
}

// 生成CSV内容
function generateCSV(data) {
  const headers = ['弹幕内容', 'UP主', '直播间ID', '直播间标题', '时间'];
  const rows = data.map(item => [
    `"${item.content.replace(/"/g, '""')}"`,
    `"${item.upName.replace(/"/g, '""')}"`,
    item.roomId,
    `"${item.roomTitle.replace(/"/g, '""')}"`,
    `"${item.date}"`
  ]);
  
  return [headers, ...rows].map(row => row.join(',')).join('\n');
}

// 清空所有数据
function clearAllData() {
  if (!confirm('确定要清空所有被禁弹幕记录吗？此操作不可恢复！')) {
    return;
  }
  
  chrome.storage.local.remove(['bannedDanmakus'], function() {
    if (chrome.runtime.lastError) {
      alert('清空数据失败: ' + chrome.runtime.lastError.message);
    } else {
      alert('数据已清空');
      loadDanmakus();
    }
  });
}

// HTML转义
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 显示错误信息
function showError(message) {
  content.innerHTML = `<div class="empty-state" style="color: #ff4757;">${message}</div>`;
}