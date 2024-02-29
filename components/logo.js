import Link from 'next/link'
// import Image from 'next/image'
import {Text, useColorModeValue} from '@chakra-ui/react'
// import FootprintIcon from './icons/footprint'
import styled from '@emotion/styled'


const LogoBox = styled.span`
    display: inline-flex;
    align-items: center;
    font-size: 18px;
    font-weight: bold;
    height: 30px;
    line-height:20px;
    padding: 10px;

  &:hover {
    transform: rotate(5deg);
  }
`

const Logo = () => {
    // const footprints = `./icons/footprint${useColorModeValue('','-dark')}.svg`

    return (
        (<Link href="/" scroll={false}>
            <LogoBox>
                {/* <Image src={footprints} alt="logo" width={20} height={20} /> */}
                {/* <FootprintIcon /> */}
                <Text 
                color= {useColorModeValue('gray.800', 'whiteAlpha.900')}
                fontFamily = 'M PLUS Rounded 1c'
                fontWeight="bold"
                ml={3}>
                Apram Ahuja
                </Text>
            </LogoBox>
        </Link>)
    );
}

export default Logo