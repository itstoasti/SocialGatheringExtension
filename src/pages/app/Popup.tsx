/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
import type { IUsageStatisticsRepository } from '#domain/repositories/usageStatistics'
import { getText as i18n } from '#libs/i18n'
import PopupFeatureBlock, {
  type PopupFeatureBlockProps,
} from '#pages/components/PopupFeatureBlock'
import PopupPostingOptions from '#pages/components/PopupPostingOptions'
import useLocaleVariables from '#pages/hooks/useLocaleVariables'
import useStatsStore from '#pages/hooks/useStatsStore'
import Links from '#pages/links'
import { createStatsStore } from '#pages/stores/StatsStore'
import type { TestableComponent } from '#pages/types/props'
import { V4Statistics } from '#schema'
import { getFullVersion } from '#utils/runtime'
import {
  Box,
  Center,
  ColorProps,
  Flex,
  HStack,
  Icon,
  IconButton,
  Link,
  Spacer,
  Stack,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  VStack,
} from '@chakra-ui/react'
import React, { memo, useCallback, useEffect, useState } from 'react'
import { BiCoffeeTogo, BiFile } from 'react-icons/bi'
import { FaGithub } from 'react-icons/fa'
import { IoMdSettings } from 'react-icons/io'
import type { IconType } from 'react-icons/lib'
import {
  MdOutlineSentimentDissatisfied,
  MdOutlineSentimentSatisfied,
} from 'react-icons/md'
import { type Storage, runtime, storage, tabs } from 'webextension-polyfill'

const NavBar = () => {
  return (
    <Flex w="100%" h="30px" p={1} align="center">
      <Spacer />
      <IconButton
        aria-label="settings"
        variant="ghost"
        bg="transparent"
        color="white"
        _hover={{ bg: 'rgba(255, 255, 255, 0.33)' }}
        _active={{ bg: 'rgba(255, 255, 255, 0.66)' }}
        icon={<Icon boxSize={5} as={IoMdSettings} />}
        onClick={() => runtime.openOptionsPage()}
        data-testid="navbar-options"
        size="sm"
      />
    </Flex>
  )
}

// const calcStats = (count: number, fix: number) => {
//   const base = Math.pow(10, fix)
//   return Math.round(((count + Number.EPSILON) / 1000) * base) / base
// }

export type StatsProps = {
  usageStatisticsRepo: IUsageStatisticsRepository
}

const isStatisticsKey = (key: string): key is keyof V4Statistics => true

const Stats = (props: StatsProps) => {
  const [stats, { criterias, triggerChange }] = useStatsStore(
    createStatsStore({ getStats: async () => props.usageStatisticsRepo.get() })
  )

  useEffect(() => {
    const statsListener: ListenerOf<Storage.Static['onChanged']> = (
      changes,
      _areaName
    ) => {
      if (
        Object.keys(changes).some(
          storageKey => isStatisticsKey(storageKey) && criterias.has(storageKey)
        )
      )
        triggerChange()
    }

    storage.onChanged.addListener(statsListener)
    return () => storage.onChanged.removeListener(statsListener)
  }, [criterias, triggerChange])

  return (
    <Box>
      <Center>
        <Text as="span" fontSize={'4rem'} fontWeight={600} lineHeight="shorter">
          {stats.mapBy(props => props.downloadCount)}
        </Text>
      </Center>
      <Center>
        <Text as="span" fontSize={'2rem'} m={0} lineHeight={1} fontWeight={500}>
          Downloads
        </Text>
      </Center>
    </Box>
  )
}

type ReactionProps = {
  icon: IconType
  iconColor: ColorProps['color']
  name: string
}

const Reaction = (props: ReactionProps) => (
  <HStack>
    <Icon color={props.iconColor} boxSize={5} as={props.icon} />
    <Text>{props.name}</Text>
  </HStack>
)

const ReactionsBlock = () => {
  return (
    <Stack spacing={2} fontSize={'0.8em'}>
      <Link href={Links.store} target="_blank" data-testid="reaction-rate">
        <Reaction
          name={i18n('Rate it', 'popup')}
          iconColor={'brand.green'}
          icon={MdOutlineSentimentSatisfied}
        />
      </Link>
      <Link href={Links.issues} target="_blank" data-testid="reaction-report">
        <Reaction
          name={i18n('Report issues', 'popup')}
          iconColor={'brand.red'}
          icon={MdOutlineSentimentDissatisfied}
        />
      </Link>
    </Stack>
  )
}

type FooterActionButtonProps = {
  icon: IconType
  label: string
  info: string
  link: string
  setInfo: (info: string) => void
  infoReseter: () => void
} & TestableComponent

const FooterActionButton = memo((props: FooterActionButtonProps) => {
  return (
    <IconButton
      aria-label={props.label}
      variant="ghost"
      bg="transparent"
      borderRadius="0"
      _hover={{ bg: 'rgba(0, 0, 0, 0.33)' }}
      _active={{ bg: 'rgba(0, 0, 0, 0.66)' }}
      size="sm"
      color="white"
      icon={<Icon boxSize={4} as={props.icon} />}
      onMouseEnter={() => props.setInfo(props.info)}
      onMouseLeave={props.infoReseter}
      onClick={() => tabs.create({ active: true, url: props.link })}
      data-testid={props.testId}
    />
  )
})

const versionName = 'v' + getFullVersion()

const Footer = () => {
  const [info, setInfo] = useState(versionName)
  const resetInfo = useCallback(() => setInfo(versionName), [])

  return (
    <Flex
      bg="#404040"
      bottom="0"
      w="100%"
      h="20px"
      pl={1}
      pr={1}
      justify="center"
      align="center"
    >
      <Box fontSize={'md'} ml="8px" mr="8px" color="white">
        <span data-testid="footer-info">{info}</span>
      </Box>
      <Spacer />
      <FooterActionButton
        icon={BiFile}
        label="Changelog"
        info={i18n('Changelog', 'popup')}
        link={Links.changelog}
        setInfo={setInfo}
        infoReseter={resetInfo}
        testId="footer-action-changelog"
      />
      <FooterActionButton
        icon={FaGithub}
        label="Github"
        info="Github"
        link={Links.github}
        setInfo={setInfo}
        infoReseter={resetInfo}
        testId="footer-action-github"
      />
      <FooterActionButton
        icon={BiCoffeeTogo}
        label="Donate"
        info={i18n('Buy me a coffee!', 'popup')}
        link={Links.koFi}
        setInfo={setInfo}
        infoReseter={resetInfo}
        testId="footer-action-kofi"
      />
    </Flex>
  )
}

const DashboardTab = (props: PopupFeatureBlockProps & StatsProps) => {
  const baseFontSize = useLocaleVariables({
    fallback: '1.5rem',
    ja: '1rem',
    zh: '1.2rem',
  })

  return (
      <Stack spacing={3} fontSize={baseFontSize} flex="1" p={2}>
        <Stats usageStatisticsRepo={props.usageStatisticsRepo} />
        <PopupFeatureBlock featureSettingsRepo={props.featureSettingsRepo} />
        <VStack align={'center'} flex="1" spacing={2} justify="center">
          <ReactionsBlock />
        </VStack>
    </Stack>
  )
}

const PostingTab = () => {
  return (
    <PopupPostingOptions />
  )
}

export type PopupProps = PopupFeatureBlockProps & StatsProps

const Popup = (props: PopupProps) => {
  return (
    <VStack spacing={0} h="100vh" w="100vw" overflow="hidden">
      <NavBar />
      <Tabs colorScheme="blue" size="sm" variant="enclosed" flex="1" w="full" display="flex" flexDirection="column">
        <TabList>
          <Tab>Dashboard</Tab>
          <Tab>{i18n('Posting', 'options:sideMenu')}</Tab>
        </TabList>
        <TabPanels flex="1" display="flex" flexDirection="column">
          <TabPanel p={0} flex="1" display="flex" flexDirection="column">
            <DashboardTab {...props} />
          </TabPanel>
          <TabPanel p={0} flex="1" display="flex" flexDirection="column">
            <PostingTab />
          </TabPanel>
        </TabPanels>
      </Tabs>
      <Footer />
    </VStack>
  )
}

export default Popup
