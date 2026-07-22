import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Landing from './pages/Landing'
import SinglePredict from './pages/SinglePredict'
import BatchArena from './pages/BatchArena'
import ModelLab from './pages/ModelLab'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Landing />} />
          <Route path="predict" element={<SinglePredict />} />
          <Route path="batch" element={<BatchArena />} />
          <Route path="models" element={<ModelLab />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
