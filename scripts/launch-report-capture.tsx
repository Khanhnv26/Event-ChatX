import React from 'react';
import { createRoot } from 'react-dom/client';
import '../frontend/src/index.css';
import { ExportSummaryModal } from '../frontend/src/components/room/ExportSummaryModal';
import { eventChatApi } from '../frontend/src/services/eventChatApi';
import type { RoomExportResponse } from '../frontend/src/types/backend.types';

// Component-story fixture only. No API server or production route is changed.
const report: RoomExportResponse = {
 roomSlug:'workshop',roomTitle:'Workshop sáng tạo',roomStatus:'ACTIVE',exportedAt:'2026-10-30T09:00:00Z',participantCount:3,
 confirmedDecisions:[{id:1,text:'Chọn chủ đề Design Thinking',status:'CONFIRMED',creatorNickname:'Khánh',confirmedByNickname:'Khánh',confirmedAt:'2026-10-30T02:42:00Z',approveCount:2,rejectCount:0,evidenceRefs:[],createdAt:'2026-10-30T08:55:00Z'}],
 polls:[{id:1,question:'Chủ đề workshop tiếp theo?',allowMultiple:false,status:'OPEN',createdAt:'2026-10-30T08:54:00Z',closedAt:null,options:[{id:1,label:'Design Thinking',voteCount:2,displayOrder:0},{id:2,label:'Kỹ năng thuyết trình',voteCount:1,displayOrder:1}]}],
 wheels:[],markdownSummary:'# Workshop sáng tạo\n\nChủ đề đã chốt: Design Thinking.\nBình chọn: 2 phiếu đồng thuận.',
};
eventChatApi.exportSummary=async()=>report;
document.documentElement.classList.add('dark');document.documentElement.dataset.motion='reduced';
createRoot(document.getElementById('root')!).render(<ExportSummaryModal isOpen roomCode="workshop" onClose={()=>{}}/>);

