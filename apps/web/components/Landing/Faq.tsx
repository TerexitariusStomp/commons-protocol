import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Box,
  Heading,
} from '@chakra-ui/react'
import useTranslation from 'next-translate/useTranslation'
import { FC } from 'react'

const Faq: FC = () => {
  const { t } = useTranslation('templates')
  return (
    <Box py={16} bg="gray.50" borderTopWidth="1px">
      <Box maxW="3xl" mx="auto" px={4}>
        <Heading variant="heading1" textAlign="center" mb={10} fontSize={{ base: '2xl', md: '4xl' }}>
          {t('landing.faq.title')}
        </Heading>
        <Accordion allowMultiple>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <AccordionItem key={i} bg="white" rounded="2xl" borderWidth="1px" mb={3} overflow="hidden">
              <AccordionButton px={6} py={4}>
                <Box flex="1" textAlign="left" fontWeight="semibold" fontSize="sm">
                  {t(`landing.faq.q${i}`)}
                </Box>
                <AccordionIcon />
              </AccordionButton>
              <AccordionPanel px={6} pb={5} fontSize="sm" color="gray.600" lineHeight="relaxed">
                {t(`landing.faq.a${i}`)}
              </AccordionPanel>
            </AccordionItem>
          ))}
        </Accordion>
      </Box>
    </Box>
  )
}

export default Faq
