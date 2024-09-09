import NextLink from 'next/link'
import {
  Link,
  Container,
  Heading,
  Box,
  Button,
  List,
  ListItem,
  useColorModeValue
} from '@chakra-ui/react'
import Image from 'next/image'
import Section from '../components/section'
import Layout from '../components/layouts/article'
import { ChevronRightIcon, EmailIcon } from '@chakra-ui/icons'
import { IoLogoTwitter, IoLogoInstagram, IoLogoGithub, IoLogoLinkedin} from 'react-icons/io5'
import Paragraph from '../components/paragraph'
import { Analytics } from "@vercel/analytics/react"

import {Profile} from "../public/const/const.js"
import {Resume} from "../public/const/const.js"
import {GitHub} from "../public/const/const.js"
import {LinkedIn} from "../public/const/const.js"
import {Twitter} from "../public/const/const.js"
import {Instagram} from "../public/const/const.js"
import {Email} from "../public/const/const.js"


const Page = () => {
    return (
      <Layout>
        <Container>
                <Box
                    borderRadius="lg"
                    mb={6}
                    p={3}
                    textAlign="center"
                    bg={useColorModeValue('blackAlpha.500', 'blackAlpha.200')}
                    css={{ backdropFilter: 'blur(10px)' }}
                >
                  Who's that pokemon? 🤔 
                </Box>
        <Analytics/>

        <Box display={{md:'flex'}}>
        <Box flexGrow={1}>
        <Heading as="h2" variant = "page-title">
            Apram Ahuja
        </Heading>
        <p> Developer</p>
        </Box> 
        <Box
          flexShrink={0}
          mt={{ base: 4, md: 0 }}
          ml={{ md: 6 }}
          textAlign="center"
        >
          <Box
            borderColor="whiteAlpha.800"
            borderWidth={2}
            borderStyle="solid"
            w="200px"
            h="200px"
            display="inline-block"
            borderRadius="full"
            overflow="hidden"
          >
            <Image
              src={Profile}
              alt="Profile image"
              width="200"
              height="200"
            />
          </Box>
        </Box>   
        </Box>
        <Section delay={0.1}>
        <Heading as="h3" variant="section-title">
          About Me
        </Heading>
        <Paragraph>
        👋 Hi! I am Apram Ahuja, DevOps Intern <b><a href = "https://www.optum.com/en/" target="_blank">@Optum</a></b> and pursuing Bachelors of Science in Computer Science and Minor in Data Science <b><a href = "https://www.cs.ubc.ca/">@UBC</a></b> (08/2026).
        <br/>
        🔎  I am always exploring more about data management, algorithms their complexities and solving some real-world issues using them. 
        <br/>
         🧑‍💻Skilled in JavaScript, Java, C++, MySQL and OracleSQL, HTML/CSS, OpenGL by in working on a diverse set of domains, including web development, data analysis.
        <br/>
        🥊 Interested in Kickboxing, Brazilian Jiu-jitsu and Sambo.
        </Paragraph>
        <Box align="center" my={4} justify="space-between">
          <Button 
            as={NextLink}
            href="/works"
            scroll={false}
            rightIcon={<ChevronRightIcon />}
            colorScheme="teal"
          >
            Projects
          </Button>
          &nbsp;&nbsp;&nbsp;
          <Button
            as={NextLink}
            target="_blank"
            href={Resume}
            scroll={false}
            rightIcon={<ChevronRightIcon />}
            colorScheme="teal"
          >
            Resume
          </Button>
        </Box>
      </Section>

      <Section delay={0.3}>
        <Heading as="h3" variant="section-title">
          On the web
        </Heading>
        <List>
          <ListItem>
            <Link href={GitHub} target="_blank">
              <Button
                variant="ghost"
                colorScheme="teal"
                leftIcon={<IoLogoGithub />}
              >
                @apramm
              </Button>
            </Link>
          </ListItem>
          <ListItem>
            <Link href={LinkedIn} target="_blank">
              <Button
                variant="ghost"
                colorScheme="teal"
                leftIcon={<IoLogoLinkedin />}
              >
                @apramahuja
              </Button>
            </Link>
          </ListItem>
          <ListItem>
            <Link href={Twitter} target="_blank">
              <Button
                variant="ghost"
                colorScheme="teal"
                leftIcon={<IoLogoTwitter />}
              >
                @apram0235
              </Button>
            </Link>
          </ListItem>
          <ListItem>
            <Link href={Instagram} target="_blank">
              <Button
                variant="ghost"
                colorScheme="teal"
                leftIcon={<IoLogoInstagram />}
              >
                @apramahuja
              </Button>
            </Link>
          </ListItem>
        </List>

        <Box align="center" my={4}>
          <Button
            as={NextLink}
            href= {Email}
            scroll={false}
            leftIcon={<EmailIcon />}
            colorScheme="teal"
          >
            Reach out to me
          </Button>
        </Box>

        </Section>

        </Container>
        </Layout>
    );
}

export default Page;