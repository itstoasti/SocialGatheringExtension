/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
import type { ISettingsRepository } from '#domain/repositories/settings'
import type { InitPayloadAction, PureAction } from '#pages/types/reducerAction'
import type { DownloadSettings } from '#schema'
import { useEffect, useReducer } from 'react'

function reducer(
  settings: DownloadSettings,
  action:
    | PureAction<'toggleAria2' | 'toggleAggressive' | 'toggleAskWhere'>
    | InitPayloadAction<DownloadSettings>
): DownloadSettings {
  switch (action.type) {
    case 'toggleAggressive':
      return { ...settings, aggressiveMode: !settings.aggressiveMode }
    case 'toggleAria2':
      return { ...settings, enableAria2: !settings.enableAria2 }
    case 'toggleAskWhere':
      return { ...settings, askWhereToSave: !settings.askWhereToSave }
    case 'init':
      return action.payload
  }
}

type Toggler = Record<keyof DownloadSettings, () => Promise<void>>

const useDownloadSettings = (
  downloadSettingsRepo: ISettingsRepository<DownloadSettings>
): {
  settings: DownloadSettings
  toggler: Toggler
  canAskSaveLocation: boolean
} => {
  const [downloadSettings, dispatch] = useReducer(
    reducer,
    downloadSettingsRepo.getDefault()
  )

  useEffect(() => {
    downloadSettingsRepo.get().then(settings => {
      dispatch({
        type: 'init',
        payload: settings,
      })
    })
  }, [downloadSettingsRepo])

  const toggleAria2 = async () => {
    if (downloadSettings.enableAria2 === false) {
      /* TODO: Test aria2 connection */
    }
    await downloadSettingsRepo.save({
      enableAria2: !downloadSettings.enableAria2,
    })
    dispatch({ type: 'toggleAria2' })
  }

  const toggleAggressive = async () => {
    await downloadSettingsRepo.save({
      aggressiveMode: !downloadSettings.aggressiveMode,
    })
    dispatch({ type: 'toggleAggressive' })
  }

  const toggleAskWhereToSave = async () => {
    try {
      // First update the setting in storage
    await downloadSettingsRepo.save({
      askWhereToSave: !downloadSettings.askWhereToSave,
    })
      
      // Then update the local state
    dispatch({ type: 'toggleAskWhere' })
      
      // Verify the setting was saved
      const savedSettings = await downloadSettingsRepo.get()
      if (savedSettings.askWhereToSave === downloadSettings.askWhereToSave) {
        // Setting didn't change, try again
        await downloadSettingsRepo.save({
          askWhereToSave: !downloadSettings.askWhereToSave,
        })
      }
    } catch (error) {
      console.error('Error saving askWhereToSave setting:', error)
      // Force a fresh reload of settings
      const currentSettings = await downloadSettingsRepo.get()
      dispatch({
        type: 'init',
        payload: currentSettings,
      })
    }
  }

  return {
    settings: downloadSettings,
    toggler: {
      enableAria2: toggleAria2,
      aggressiveMode: toggleAggressive,
      askWhereToSave: toggleAskWhereToSave,
    },
    canAskSaveLocation: downloadSettings.enableAria2 === false,
  }
}

export default useDownloadSettings
