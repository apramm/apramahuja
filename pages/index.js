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
                Hello, I&apos;m snorlax. I like to sleep and eat. I also like to code.
            </Box>

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
              src="/images/apram.jpg"
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
        👋 Hi! I am Apram Ahuja. Currently pursuing a Bachelors of Science in Mathematics and Minor in Data Science @UBC (08/2025).
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
            href="https://drive.google.com/file/d/1Z60R5hDMHbkpfXUv7uY5ej99URXhJiKC/view?usp=sharing"
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
            <Link href="https://github.com/apramm" target="_blank">
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
            <Link href="https://www.linkedin.com/in/apram/" target="_blank">
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
            <Link href="https://twitter.com/apram0235" target="_blank">
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
            <Link href="https://instagram.com/apramahuja" target="_blank">
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
            href= "mailto:apri@student.ubc.ca"
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