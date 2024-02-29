import Head from "next/head"
import Navbar from "../navbar"
import { Box, Container } from "@chakra-ui/react"
import Snorlax from "../snorlax"
import dynamic from 'next/dynamic'

const LazyVoxelDog = dynamic(() => import('../snorlax'), {
    ssr: false,
    loading: () => <Snorlax />
  })

const Main = ({ children,router }) => {
    return (
        <Box as="main" pb={8}>
            <Head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0"/>    
                <title>Apram Ahuja - Homepage</title>
            </Head>

            <Navbar path={router.asPath} />  

            <Container maxW = "container.md" pt={14}>
                <LazyVoxelDog />
                {children}
            </Container>
        </Box>
            )
        }

export default Main