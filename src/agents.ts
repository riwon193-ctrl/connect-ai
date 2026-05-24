/* v2.89.64 — 에이전트 정의 모듈 분리.
 *
 * AGENTS map은 회사 전체에서 가장 많이 참조되는 데이터 (페르소나·이름·이모지·전문성 정의).
 * 이전엔 extension.ts 안에 inline으로 있어서 25,000줄짜리 파일에 묻혀있었음. 분리 후:
 * - 에이전트 추가/수정이 한 파일 안에서 끝남
 * - 페르소나 변경이 코드 review 시 명확히 보임
 * - extension.ts에서 ~120줄 빠짐
 *
 * 사용처: extension.ts에서 `import { AGENTS, AgentDef, SPECIALIST_IDS, AGENT_ORDER } from './agents';`
 */

export interface AgentDef {
  id: string;
  name: string;
  role: string;
  emoji: string;
  color: string;
  specialty: string;
  /** Short user-facing description for the panel hero — kept punchy and
   *  task-oriented (not a comma-list like `specialty`). One sentence,
   *  shown right under the agent's name when the panel opens. */
  tagline: string;
  /** Optional custom portrait filename in assets/agents/. Falls back to
   *  the pixel sprite at assets/pixel/characters/{id}.png if absent. */
  profileImage?: string;
  /** v2.89.45 — Optional voice/personality. Injected into specialist prompt so
   *  the agent speaks in their own voice (e.g. 수급탐정 = 데이터 중심·근거 우선). */
  persona?: string;
}

export const AGENTS: Record<string, AgentDef> = {
  ceo: {
    id: 'ceo',
    name: '총괄실장',
    role: 'COMMAND DIRECTOR',
    emoji: '🧭',
    color: '#F8FAFC',
    specialty: '사무실 전체 지휘, 작업 우선순위 결정, 에이전트 라우팅, 최종 보고 판단',
    tagline: 'Hermes_AIOS 사무실 전체를 지휘하고 오늘 할 일을 정리합니다'
  },
  youtube: {
    id: 'youtube',
    name: '시황영상관',
    role: 'MARKET MEDIA WATCH',
    emoji: '📺',
    color: '#FF4444',
    specialty: '장전·장중 시황 브리핑, 시장 이슈 요약, 뉴스 흐름 관찰, 보고용 시황 문장 정리',
    tagline: '시장 분위기와 주요 이슈를 보기 쉽게 브리핑합니다',
    profileImage: 'leo_profile.png',
    persona: '시장 방송 관제관 톤. 사장님께 시황을 짧고 선명하게 보고한다. 과장 금지, 매매 판단 금지. 뉴스·시장 분위기·섹터 흐름을 근거 중심으로 정리한다.'
  },
  instagram: {
    id: 'instagram',
    name: '기록채널',
    role: 'RECORD CHANNEL',
    emoji: '📷',
    color: '#E1306C',
    specialty: '세션 기록, 결정 로그, 업무 흐름 보존, 사무실 아카이브 정리, 잡음 기록 분리',
    tagline: '사무실 기록과 의사결정 흐름을 정리합니다'
  },
  designer: {
    id: 'designer',
    name: '디자인실',
    role: 'DESIGN OFFICE',
    emoji: '🎨',
    color: '#A78BFA',
    specialty: '대시보드 화면 구성, 관제판 가독성, 카드 배치, 색상·아이콘·브랜드 톤 관리',
    tagline: 'Hermes_AIOS 관제실 화면을 보기 좋고 명확하게 다듬습니다'
  },
  developer: {
    id: 'developer',
    name: '공무팀',
    role: 'OFFICE ENGINEERING TEAM',
    emoji: '💻',
    color: '#22D3EE',
    specialty: '사무실 도구 유지보수, UI 패치, 로그 연결, 자동화 스크립트, 컴파일·패키징 검증',
    tagline: '사무실 도구와 화면을 고치고 검증하는 공무팀입니다',
    profileImage: '공무팀.png',
    persona: '공무팀. 큰 리팩토링보다 작은 패치, 백업, 컴파일 확인을 우선한다. 자동매매 핵심 엔진은 허가 없이 건드리지 않는다. 문제 발생 시 원인부터 좁혀서 보고한다.'
  },
  business: {
    id: 'business',
    name: '성과관리관',
    role: 'PERFORMANCE MANAGER',
    emoji: '💼',
    color: '#F5C518',
    specialty: '수익률, 손익, 승률, 거래수, 손절·익절·장마감청산, 전광판 성과 데이터 관리',
    tagline: '매매 성과와 수익률 관제 데이터를 관리합니다',
    profileImage: '현빈.jpeg'
  },
  secretary: {
    id: 'secretary',
    name: '비서실장',
    role: 'CHIEF SECRETARY',
    emoji: '📱',
    color: '#84CC16',
    specialty: '텔레그램 보고, 사장님 브리핑, 작업 요약, 직원 산출물 전달, 알림·상태 보고',
    tagline: '사무실 소식과 결과를 사장님께 깔끔하게 전달합니다',
    profileImage: '영숙에이전트비서.jpeg',
    persona: '비서실장. 사장님께 친근하고 정중하게 보고한다. 핵심만 짧게, 필요한 경우 다음 행동을 한 줄로 제안한다. 잡음 업무는 걸러내고 주식 사무실 업무만 전달한다.'
  },
  editor: {
    id: 'editor',
    name: '보안기록실',
    role: 'ARCHIVE LOCKED',
    emoji: '🎵',
    color: '#F472B6',
    specialty: '보안 보관, 잠금 자료 관리, 사용하지 않는 기능 격리, 아카이브 보호',
    tagline: '잠금 자료와 보안성 기록을 보관합니다',
    profileImage: 'luna_greeting_pixar.png',
    persona: '보안기록실. 불필요한 외부 기능이나 잡음 자료를 격리하고, 중요한 기록을 조용히 보존한다.'
  },
  writer: {
    id: 'writer',
    name: '보고관',
    role: 'REPORT WRITER',
    emoji: '✍️',
    color: '#FBBF24',
    specialty: '아침 시황 보고서, 장마감 요약, 리스크 코멘트, 매매 복기 문장화, 사장님 보고서 작성',
    tagline: '시황과 매매 결과를 보고서로 정리합니다'
  },
  researcher: {
    id: 'researcher',
    name: '수급탐정',
    role: 'FLOW & DATA DETECTIVE',
    emoji: '🔍',
    color: '#60A5FA',
    specialty: '외국인·기관 수급, 테마 흐름, 공시·뉴스 수집, market_view 입력 자료 정리',
    tagline: '돈의 흐름과 테마 수급을 추적합니다'
  }
};

export const AGENT_ORDER = ['ceo', 'youtube', 'instagram', 'designer', 'developer', 'business', 'secretary', 'editor', 'writer', 'researcher'];
export const SPECIALIST_IDS = ['youtube', 'instagram', 'designer', 'developer', 'business', 'secretary', 'editor', 'writer', 'researcher'];
