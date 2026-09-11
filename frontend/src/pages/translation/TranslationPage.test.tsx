import '../../test/setup'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AppDataProvider } from '../../hooks/useAppData'
import TranslationPage from './TranslationPage'

describe('TranslationPage', () => {
  it('switches between all translation modes', async () => { const user = userEvent.setup(); render(<MemoryRouter><AppDataProvider><TranslationPage/></AppDataProvider></MemoryRouter>); expect(screen.getByLabelText('输入内容')).toBeInTheDocument(); await user.click(screen.getByRole('tab',{name:/语音/})); expect(screen.getByText('点击麦克风开始讲话')).toBeInTheDocument(); await user.click(screen.getByRole('tab',{name:/视频/})); expect(screen.getByText('选择一段韩国视频')).toBeInTheDocument() })
  it('shows a translated result', async () => { const user=userEvent.setup(); render(<MemoryRouter><AppDataProvider><TranslationPage/></AppDataProvider></MemoryRouter>); await user.click(screen.getByRole('button',{name:'开始翻译'})); expect(await screen.findByText('경복궁에 가고 싶어요.')).toBeInTheDocument() })
})
