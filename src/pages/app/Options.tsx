/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
import type { IClientRepository } from '#domain/repositories/client'
import type { IDownloadRepository } from '#domain/repositories/download'
import type { IDownloadHistoryRepository } from '#domain/repositories/downloadHistory'
import type { IPortableDownloadHistoryRepository } from '#domain/repositories/portableDownloadHistory'
import type { ISettingsRepository } from '#domain/repositories/settings'
import type { IWarningSettingsRepo } from '#domain/repositories/warningSettings'
import type { CheckDownloadWasTriggeredBySelf } from '#domain/useCases/checkDownloadWasTriggeredBySelf'
import type { DownloadFileUseCase } from '#domain/useCases/downloadFile'
import type { SearchDownloadHistory } from '#domain/useCases/searchDownloadHistory'
import type { SearchTweetIdsByHashTags } from '#domain/useCases/searchTweetIdsByHashtags'
import type { FilenameSetting } from '#domain/valueObjects/filenameSetting'
import { getText as i18n } from '#libs/i18n'
import About from '#pages/components/About'
import FootBar from '#pages/components/FootBar'
import GeneralOptions from '#pages/components/GeneralOptions'
import HistoryTable from '#pages/components/History'
import PostingOptions from '#pages/components/PostingOptions'
import Dashboard from '#pages/components/Dashboard'
import Calendar from '#pages/components/Calendar'

import SideMenu from '#pages/components/SideMenu'
import { DownloadSettings, FeatureSettings } from '#schema'
import {
  Box,
  HStack,
  Heading,
  Stack,
} from '@chakra-ui/react'
import type { JSX } from 'react'
import React from 'react'
import { HashRouter, Route, Routes } from 'react-router-dom'

type ContentProps = {
  title: string
  children?: JSX.Element
}

const Content = (props: ContentProps) => {
  return (
    <Box width="100%">
      <Heading p={'1.5rem'} pt={10}>{props.title}</Heading>
      {props.children}
    </Box>
  )
}

type RepoProvider = {
  clientRepo: IClientRepository
  downloadSettingsRepo: ISettingsRepository<DownloadSettings>
  filenameSettingsRepo: ISettingsRepository<FilenameSetting>
  featureSettingsRepo: ISettingsRepository<FeatureSettings>
  warningSettingsRepo: IWarningSettingsRepo
  portableDownloadHistoryRepo: IPortableDownloadHistoryRepository
  downloadHistoryRepo: IDownloadHistoryRepository
  downloadRepo: IDownloadRepository
  checkDownloadIsOwnBySelf: CheckDownloadWasTriggeredBySelf
}

type UseCaseProvider = {
  searchDownloadHistory: SearchDownloadHistory
  searchTweetIdsByHashtags: SearchTweetIdsByHashTags
  browserDownload: DownloadFileUseCase
}

type InfraProvider = RepoProvider & UseCaseProvider

const App = ({
  clientRepo,
  downloadSettingsRepo,
  filenameSettingsRepo,
  featureSettingsRepo,
  searchDownloadHistory,
  searchTweetIdsByHashtags,
  warningSettingsRepo,
  portableDownloadHistoryRepo,
  downloadHistoryRepo,
  browserDownload,
  downloadRepo,
  checkDownloadIsOwnBySelf,
}: InfraProvider) => {
  return (
    <HStack flex={1} spacing={0} overflow={'hidden'}>
      <HashRouter>
        <SideMenu />
        <Stack flex={1} height={'full'} overflow={'auto'} align="stretch" width="100%" spacing={0}>
          <Box flex={1} overflow={'auto'}>
            <Routes>
            <Route
              path="/"
              element={
                <Content title="Dashboard">
                  <Dashboard />
                </Content>
              }
            />
            <Route
              path="/calendar"
              element={
                <Content title="Calendar">
                  <Calendar />
                </Content>
              }
            />
            <Route
              path="/posting"
              element={
                <Content title={i18n('Posting', 'options:sideMenu')}>
                  <PostingOptions />
                </Content>
              }
            />
            <Route
              path="/history"
              element={
                <Content
                  title={i18n('History', 'options:sideMenu')}
                >
                  <HistoryTable
                    searchDownloadHistory={searchDownloadHistory}
                    searchTweetIdsByHashtags={searchTweetIdsByHashtags}
                    portableDownloadHistoryRepo={portableDownloadHistoryRepo}
                    downloadHistoryRepo={downloadHistoryRepo}
                    browserDownload={browserDownload}
                    downloadRepo={downloadRepo}
                    checkDownloadIsOwnBySelf={checkDownloadIsOwnBySelf}
                  />
                </Content>
              }
            />
            <Route
              path="/statistics"
              element={<Content title="Statistics" />}
            />
            <Route
              path="/about"
              element={
                <Content title={i18n('About', 'options:sideMenu')}>
                  <About clientRepo={clientRepo} />
                </Content>
              }
            />
            <Route
              path="/settings"
              element={
                <Content title="Settings">
                  <GeneralOptions
                    downloadSettingsRepo={downloadSettingsRepo}
                    filenameSettingsRepo={filenameSettingsRepo}
                    featureSettingsRepo={featureSettingsRepo}
                    warningSettingsRepo={warningSettingsRepo}
                  />
                </Content>
              }
            />
          </Routes>
          </Box>
          <FootBar />
        </Stack>
      </HashRouter>
    </HStack>
  )
}

export default App
