import { ChakraProvider } from "@chakra-ui/react"
import Layout from "../components/layouts/main.js"
import Theme from "../lib/theme.js"
import Fonts from "../components/font.js"
import { AnimatePresence } from 'framer-motion'

const Website = ({ Component, pageProps, router}) => {
    return(
        <ChakraProvider theme={Theme}>
            <Fonts />
            <Layout router={router}>
            <AnimatePresence
                mode="wait"
                initial={true}
                onExitComplete={() => {
                    if (typeof window !== 'undefined') {
                    window.scrollTo({ top: 0 })
                    }
                }}
                >
                <Component {...pageProps} key={router.route}/>
            </AnimatePresence>
            </Layout>
        </ChakraProvider>
    )
}
export default Website