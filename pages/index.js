import NextLink from 'next/link'
import {
  Link,
  Container,
  Heading,
  Box,
  Button,
  SimpleGrid
} from '@chakra-ui/react'
import Image from 'next/image'
import Section from '../components/section'
import Layout from '../components/layouts/article'
import { ChevronRightIcon, EmailIcon } from '@chakra-ui/icons'
import { IoLogoInstagram, IoLogoGithub, IoLogoLinkedin} from 'react-icons/io5'
import {FaStrava} from 'react-icons/fa'
import Paragraph from '../components/paragraph'
import { Analytics } from '@vercel/analytics/react'
import {useColorModeValue } from '@chakra-ui/react'

import {Profile} from '../public/const/const.js'
import {Resume} from '../public/const/const.js'
// import {Resume} from '../components/resume.js'
import {GitHub} from '../public/const/const.js'
import {LinkedIn} from '../public/const/const.js'
import {Strava} from '../public/const/const.js'
import {Instagram} from '../public/const/const.js'
import {Email} from '../public/const/const.js'


const Page = () => {
    return (
      <Layout>
        <Container>
        <Box
            borderRadius="lg"
            mb={6}
            p={1}
            textAlign="center"
            bg={useColorModeValue('blackAlpha.500', 'blackAlpha.200')}
            css={{ backdropFilter: 'blur(10px)' }}
          >
            &quot;Toji represents pure human potential - skill, willpower, and strategy.&quot;
          </Box>

        <Analytics/>

        <Box display={{md:'flex'}}>
        <Box flexGrow={1}>
        <Heading as='h2' variant = 'page-title'>
            Apram Ahuja
        </Heading>
        </Box> 
        <Box
          flexShrink={0}
          mt={{ base: 4, md: 0 }}
          ml={{ md: 6}}
          textAlign='center'
        >
          <Box
            borderColor='whiyellowpha.800'
            borderWidth={5}
            borderStyle='double'
            w='185px'
            h='185px'
            display='inline-block'
            borderRadius='full'
            overflow='hidden'
          >
            <Image
              src={Profile}
              alt='Profile image'
              width='200'
              height='200'
            />
          </Box>
        </Box>   
        </Box>
        <Section delay={0.1}>
        <Heading as='h3' variant='section-title'>
          About Me
        </Heading>
        <Paragraph>
        👋 Hi! I am Apram Ahuja, Software and DevOps Engineer Intern <b><a href = 'https://www.optum.com/en/' target='_blank'>@Optum</a></b>, pursuing Bachelors of Science in Computer Science and Minor in Data Science <b><a href = 'https://www.cs.ubc.ca/'>@UBC</a></b> (08/2026).
        <br/>
        🔎  Interested in Algorithm design & mathematical modelling, software construction. Love to explore newer interests and pushing further boundaries.
        <br/>
         🧑‍💻 Skilled in JavaScript, Java, C++, .NET, Python, OpenGL and working on a diverse set of domains, including distributed systems and data engineering.
        <br/>
        🥊 Run, Swim, Gym, Kickboxing, Brazilian Jiu-jitsu and Sambo.
        </Paragraph>
        <Box align='center' my={4}  gap={40} justifyContent='center'>
          <Button 
            as={NextLink}
            href='/works'
            scroll={false}
            rightIcon={<ChevronRightIcon />}
            colorScheme='purple'
          >
            Projects
          </Button>
          &nbsp;&nbsp;&nbsp;
          <Button
            as={NextLink}
            href= '\resume-page'
            scroll={false}
            rightIcon={<ChevronRightIcon />}
            colorScheme='purple'
          >
            Resume
          </Button>
        </Box>
      </Section>
      <Section delay={0.3}>
  <Heading as="h3" variant="section-title">
    On the web
  </Heading>
  <SimpleGrid columns={[1, 2]} spacing={4} mt={4}>
    <Box>
      <Link href={GitHub} target="_blank">
        <Button
          variant="ghost"
          colorScheme="#FFD082"
          leftIcon={<IoLogoGithub />}
        >
          @apramm
        </Button>
      </Link>
    </Box>
    <Box>
      <Link href={LinkedIn} target="_blank">
        <Button
          variant="ghost"
          colorScheme="#FFD082"
          leftIcon={<IoLogoLinkedin />}
        >
          @apramahuja
        </Button>
      </Link>
    </Box>
    <Box>
      <Link href={Strava} target="_blank">
        <Button
          variant="ghost"
          colorScheme="#FFD082"
          leftIcon={<FaStrava />}
        >
          @apramrun
        </Button>
      </Link>
    </Box>
    <Box>
      <Link href={Instagram} target="_blank">
        <Button
          variant="ghost"
          colorScheme="#FFD082"
          leftIcon={<IoLogoInstagram />}
        >
          @apramahuja
        </Button>
      </Link>
    </Box>
  </SimpleGrid>
  </Section>
  </Container>
   </Layout>
    );
}

export default Page;