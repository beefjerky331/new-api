/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { getTokenCreateUnlockStatus } from '../api'
import { useApiKeys } from './api-keys-provider'

export function ApiKeysPrimaryButtons() {
  const { t } = useTranslation()
  const { setOpen } = useApiKeys()
  const [checking, setChecking] = useState(false)

  const handleCreate = async () => {
    setChecking(true)
    try {
      const res = await getTokenCreateUnlockStatus()
      if (!res.success) {
        window.alert(res.message || t('请先在社区聊天室发送关键词解锁'))
        return
      }
      if (!res.data?.bound) {
        window.alert(
          t('请先绑定 dc.hhhl.cc OAuth 后再去社区聊天室发送关键词解锁。')
        )
        return
      }
      if (!res.data.unlocked) {
        window.alert(t('请先在社区聊天室发送关键词解锁'))
        return
      }
      setOpen('create')
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className='flex gap-2'>
      <Button size='sm' onClick={handleCreate} disabled={checking}>
        <Plus className='h-4 w-4' />
        {t('Create API Key')}
      </Button>
    </div>
  )
}
