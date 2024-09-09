import { Container, Heading, SimpleGrid } from '@chakra-ui/react'
import Layout from '../components/layouts/article'
import Section from '../components/section'
import { WorkGridItem } from '../components/grid-item'

import thumbAsa from '../public/images/asa.webp'
import thumbFootball from '../public/images/football.webp'
import thumbInference from '../public/images/inference.webp'
import thumbObs from '../public/images/obs.webp'
import thumbPlant from '../public/images/plantwhisperer.webp'
import thumbZoo from '../public/images/zoo.webp'
import thumbGraphics from '../public/images/graphics.png'
import { ASA, Football, Graphics, Banking, Inference, PlantWhisperer, Zoo } from '../public/const/const'

const Works = () => (
  <Layout title="Works">
    <Container>
      <Heading as="h3" fontSize={20} mb={4}>
        Projects
      </Heading>

      <SimpleGrid columns={[1, 1, 2]} gap={6}>
      <Section>
          <WorkGridItem link={Graphics} title="Real Time 3D Graphics" thumbnail={thumbGraphics}>
            Real Time Graphics Website with multiple 3D workspace using Three.js and WebGL
          </WorkGridItem>
        </Section>
        <Section>
          <WorkGridItem link={PlantWhisperer} title="PlantWhisperer" thumbnail={thumbPlant}>
            nwHacks2024 Winner 🥳 A crop disease detection app using LLM and PlantID API
          </WorkGridItem>
        </Section>
        <Section  delay={0.1}>
          <WorkGridItem
            link={Banking}
            title="Banking Simplified"
            thumbnail={thumbObs}
          >
            Desktop application for simplfied banking and budgeting
          </WorkGridItem>
        </Section>

        <Section delay={0.1}>
          <WorkGridItem
            link={Zoo}
            title="Zoo Dashboard"
            thumbnail={thumbZoo}
          >
            A dashboard for managing and tracking zoo animals and their popularity using Oracle SQL
          </WorkGridItem>
        </Section>
      </SimpleGrid>


      <SimpleGrid columns={[1, 1, 2]} gap={6}>

      <Section delay={0.3}>
          <WorkGridItem
            link={Football}
            thumbnail={thumbFootball}
            title="EPL Betting Odds Model"
          >
            A model for understanding the effectivity of betting odds on football matches
          </WorkGridItem>
        </Section>

      <Section delay={0.3}>
          <WorkGridItem link={Inference} thumbnail={thumbInference} title="Inference">
            Understanding the effect of age on Olympic Athlete performance
          </WorkGridItem>
        </Section> 

        <Section delay={0.3}>
          <WorkGridItem link={ASA} thumbnail={thumbAsa} title="ASA DataFest 2023">
            Consultancy model for Pro Bono Services @American Statistical Association DataFest
          </WorkGridItem>
        </Section>
      </SimpleGrid>
    </Container>
  </Layout>
)

export default Works
export { getServerSideProps } from '../components/chakra'