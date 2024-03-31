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
const Works = () => (
  <Layout title="Works">
    <Container>
      <Heading as="h3" fontSize={20} mb={4}>
        Works
      </Heading>

      <SimpleGrid columns={[1, 1, 2]} gap={6}>
        <Section>
          <WorkGridItem link="https://devpost.com/software/plant-whisperer" title="PlantWhisperer" thumbnail={thumbPlant}>
            nwHacks2024 Winner 🥳 A crop disease detection app using LLM and PlantID API
          </WorkGridItem>
        </Section>
        <Section>
          <WorkGridItem
            link="https://github.com/apramm/OnlineBankingSystem"
            title="Banking Simplified"
            thumbnail={thumbObs}
          >
            Desktop application for simplfied banking and budgeting
          </WorkGridItem>
        </Section>

        <Section delay={0.1}>
          <WorkGridItem
            link="https://github.com/apramm/ZooManagementSystem"
            title="Zoo Dashboard"
            thumbnail={thumbZoo}
          >
            A dashboard for managing and tracking zoo animals and their popularity using Oracle SQL
          </WorkGridItem>
        </Section>
        <Section delay={0.1}>
          <WorkGridItem link="https://github.com/aron-bram/STAT-201-2023W1-GROUP-6" thumbnail={thumbInference} title="Inference">
            Understanding the effect of age on Olympic Athlete performance
          </WorkGridItem>
        </Section>
      </SimpleGrid>

      <Section delay={0.2}>

      <SimpleGrid columns={[1, 1, 2]} gap={6}>
        <Section delay={0.3}>
          <WorkGridItem link="https://github.com/apramm/ASADatafest" thumbnail={thumbAsa} title="ASA DataFest 2023">
            Consultancy model for Pro Bono Services @American Statistical Association DataFest
          </WorkGridItem>
        </Section>
        <Section delay={0.3}>
          <WorkGridItem
            link="https://github.com/apramm/Exploring-Betting-Odds-in-a-Football-Match"
            thumbnail={thumbFootball}
            title="EPL Betting Odds Model"
          >
            A model for understanding the effectivity of betting odds on football matches
          </WorkGridItem>
        </Section>
      </SimpleGrid>
      </Section>
    </Container>
  </Layout>
)

export default Works
export { getServerSideProps } from '../components/chakra'