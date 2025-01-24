import Link from 'next/link'
// import Image from 'next/image'
import {Text, useColorModeValue} from '@chakra-ui/react'
// import FootprintIcon from './icons/footprint'
import styled from '@emotion/styled'
import Image from 'next/image'


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
    const footprints = '/images/icon.png'

    return (
        (<Link href="/" scroll={false}>
            <LogoBox>
            <Image 
                    src={footprints}
                    alt="logo"
                    width={42}
                    height={42}
                    priority  // Add priority for above-the-fold images
                    style={{  // Add style for better control
                        marginRight: '8px',
                        marginTop: '3px',
                        objectFit: 'contain'
                    }}
                />
                
            </LogoBox>
        </Link>)
    );
}

export default Logo