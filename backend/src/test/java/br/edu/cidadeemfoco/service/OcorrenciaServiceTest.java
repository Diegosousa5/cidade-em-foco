package br.edu.cidadeemfoco.service;

import br.edu.cidadeemfoco.dto.CriarOcorrenciaRequest;
import br.edu.cidadeemfoco.dto.OcorrenciaResponse;
import br.edu.cidadeemfoco.model.Ocorrencia;
import br.edu.cidadeemfoco.repository.OcorrenciaRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.Point;
import org.locationtech.jts.geom.PrecisionModel;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OcorrenciaServiceTest {

    private static final GeometryFactory GEOMETRY_FACTORY =
        new GeometryFactory(new PrecisionModel(), 4326);

    @Mock
    private OcorrenciaRepository ocorrenciaRepository;

    @InjectMocks
    private OcorrenciaService ocorrenciaService;

    @Test
    void cadastrarDeveSalvarOcorrenciaEDevolverResposta() {
        CriarOcorrenciaRequest request = request(
            "Buraco na rua", "Cratera na via", "buracos", "Rua Central, 10", -23.5, -46.6
        );
        when(ocorrenciaRepository.save(any(Ocorrencia.class))).thenAnswer(invocation -> {
            Ocorrencia ocorrencia = invocation.getArgument(0);
            ReflectionTestUtils.setField(ocorrencia, "id", 10L);
            return ocorrencia;
        });

        OcorrenciaResponse response = ocorrenciaService.cadastrar(request);

        ArgumentCaptor<Ocorrencia> captor = ArgumentCaptor.forClass(Ocorrencia.class);
        verify(ocorrenciaRepository).save(captor.capture());
        Ocorrencia saved = captor.getValue();
        assertThat(saved.getTitulo()).isEqualTo("Buraco na rua");
        assertThat(saved.getDescricao()).isEqualTo("Cratera na via");
        assertThat(saved.getCategoria()).isEqualTo("buracos");
        assertThat(saved.getEndereco()).isEqualTo("Rua Central, 10");
        assertThat(saved.getStatus()).isEqualTo("aberto");
        assertThat(saved.getDataCriacao()).isNotNull();
        assertPoint(saved.getLocalizacao(), -46.6, -23.5);
        assertThat(response).isEqualTo(new OcorrenciaResponse(
            10L, "Buraco na rua", "Cratera na via", "buracos", "Rua Central, 10",
            "aberto", saved.getDataCriacao(), -23.5, -46.6
        ));
    }

    @Test
    void listarTodasDeveDevolverOcorrenciasOrdenadasPorDataDescendente() {
        Ocorrencia maisRecente = ocorrencia(2L, "Mais recente", -23.0, -46.0);
        Ocorrencia maisAntiga = ocorrencia(1L, "Mais antiga", -24.0, -47.0);
        when(ocorrenciaRepository.findAll(Sort.by(Sort.Direction.DESC, "dataCriacao")))
            .thenReturn(List.of(maisRecente, maisAntiga));

        List<OcorrenciaResponse> responses = ocorrenciaService.listarTodas();

        assertThat(responses).extracting(OcorrenciaResponse::id).containsExactly(2L, 1L);
        assertThat(responses).extracting(OcorrenciaResponse::titulo)
            .containsExactly("Mais recente", "Mais antiga");
        verify(ocorrenciaRepository).findAll(Sort.by(Sort.Direction.DESC, "dataCriacao"));
    }

    @Test
    void atualizarDeveAtualizarCamposEDevolverResposta() {
        Ocorrencia existing = ocorrencia(5L, "Antigo", -23.0, -46.0);
        CriarOcorrenciaRequest request = request(
            "Atualizado", "Nova descrição", "iluminação pública", "Avenida Nova, 20",
            -22.9, -46.7
        );
        when(ocorrenciaRepository.findById(5L)).thenReturn(Optional.of(existing));
        when(ocorrenciaRepository.save(existing)).thenReturn(existing);

        OcorrenciaResponse response = ocorrenciaService.atualizar(5L, request);

        assertThat(response.id()).isEqualTo(5L);
        assertThat(response.titulo()).isEqualTo("Atualizado");
        assertThat(response.descricao()).isEqualTo("Nova descrição");
        assertThat(response.categoria()).isEqualTo("iluminação pública");
        assertThat(response.endereco()).isEqualTo("Avenida Nova, 20");
        assertThat(response.status()).isEqualTo("aberto");
        assertThat(response.dataCriacao()).isEqualTo(existing.getDataCriacao());
        assertThat(response.latitude()).isEqualTo(-22.9);
        assertThat(response.longitude()).isEqualTo(-46.7);
        assertPoint(existing.getLocalizacao(), -46.7, -22.9);
        verify(ocorrenciaRepository).save(existing);
    }

    @Test
    void excluirDeveRemoverOcorrenciaExistente() {
        Ocorrencia existing = ocorrencia(7L, "Para excluir", -23.0, -46.0);
        when(ocorrenciaRepository.findById(7L)).thenReturn(Optional.of(existing));

        ocorrenciaService.excluir(7L);

        verify(ocorrenciaRepository).delete(existing);
    }

    @Test
    void atualizarDeveRetornar404QuandoOcorrenciaNaoExiste() {
        when(ocorrenciaRepository.findById(404L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> ocorrenciaService.atualizar(404L, requestPadrao()))
            .isInstanceOf(ResponseStatusException.class)
            .satisfies(exception -> {
                ResponseStatusException statusException = (ResponseStatusException) exception;
                assertThat(statusException.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
                assertThat(statusException.getReason()).isEqualTo("Ocorrência não encontrada");
            });

        verify(ocorrenciaRepository, org.mockito.Mockito.never()).save(any(Ocorrencia.class));
    }

    @Test
    void excluirDeveRetornar404QuandoOcorrenciaNaoExiste() {
        when(ocorrenciaRepository.findById(404L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> ocorrenciaService.excluir(404L))
            .isInstanceOf(ResponseStatusException.class)
            .satisfies(exception -> {
                ResponseStatusException statusException = (ResponseStatusException) exception;
                assertThat(statusException.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
                assertThat(statusException.getReason()).isEqualTo("Ocorrência não encontrada");
            });

        verify(ocorrenciaRepository, org.mockito.Mockito.never()).delete(any(Ocorrencia.class));
    }

    @ParameterizedTest
    @ValueSource(doubles = {-90.01, 90.01, Double.NaN, Double.POSITIVE_INFINITY, Double.NEGATIVE_INFINITY})
    void listarProximasDeveRejeitarLatitudeInvalida(double latitude) {
        assertBadRequest(
            () -> ocorrenciaService.listarProximas(latitude, 0, 100),
            "Latitude inválida"
        );
        verifyNoInteractions(ocorrenciaRepository);
    }

    @ParameterizedTest
    @ValueSource(doubles = {-180.01, 180.01, Double.NaN, Double.POSITIVE_INFINITY, Double.NEGATIVE_INFINITY})
    void listarProximasDeveRejeitarLongitudeInvalida(double longitude) {
        assertBadRequest(
            () -> ocorrenciaService.listarProximas(0, longitude, 100),
            "Longitude inválida"
        );
        verifyNoInteractions(ocorrenciaRepository);
    }

    @ParameterizedTest
    @ValueSource(doubles = {0, -1, Double.NaN, Double.POSITIVE_INFINITY, Double.NEGATIVE_INFINITY})
    void listarProximasDeveRejeitarRaioInvalido(double raio) {
        assertBadRequest(
            () -> ocorrenciaService.listarProximas(0, 0, raio),
            "O raio deve ser maior que zero e não pode exceder 20.000.000 metros"
        );
        verifyNoInteractions(ocorrenciaRepository);
    }

    @Test
    void listarProximasDeveRejeitarRaioAcimaDoLimite() {
        assertBadRequest(
            () -> ocorrenciaService.listarProximas(0, 0, 20_000_001),
            "O raio deve ser maior que zero e não pode exceder 20.000.000 metros"
        );
        verifyNoInteractions(ocorrenciaRepository);
    }

    @ParameterizedTest
    @MethodSource("limitesLatitudeInvalidos")
    void listarPorAreaDeveRejeitarLimitesDeLatitudeInvalidos(
        double minLatitude,
        double minLongitude,
        double maxLatitude,
        double maxLongitude
    ) {
        assertBadRequest(
            () -> ocorrenciaService.listarPorArea(
                minLatitude, minLongitude, maxLatitude, maxLongitude
            ),
            "Limites de latitude inválidos"
        );
        verifyNoInteractions(ocorrenciaRepository);
    }

    @ParameterizedTest
    @MethodSource("limitesLongitudeInvalidos")
    void listarPorAreaDeveRejeitarLimitesDeLongitudeInvalidos(
        double minLatitude,
        double minLongitude,
        double maxLatitude,
        double maxLongitude
    ) {
        assertBadRequest(
            () -> ocorrenciaService.listarPorArea(
                minLatitude, minLongitude, maxLatitude, maxLongitude
            ),
            "Limites de longitude inválidos"
        );
        verifyNoInteractions(ocorrenciaRepository);
    }

    @Test
    void listarProximasDeveConsultarRaioEMapearResultados() {
        Ocorrencia near = ocorrencia(3L, "Próxima", -23.55, -46.63);
        when(ocorrenciaRepository.findWithinRadius(-23.5, -46.6, 750))
            .thenReturn(List.of(near));

        List<OcorrenciaResponse> responses =
            ocorrenciaService.listarProximas(-23.5, -46.6, 750);

        assertThat(responses).containsExactly(responseFor(near));
        verify(ocorrenciaRepository).findWithinRadius(-23.5, -46.6, 750);
    }

    @Test
    void listarPorAreaDeveConsultarLimitesEMapearResultados() {
        Ocorrencia within = ocorrencia(4L, "Dentro da área", -23.5, -46.6);
        when(ocorrenciaRepository.findWithinBoundingBox(-24, -47, -23, -46))
            .thenReturn(List.of(within));

        List<OcorrenciaResponse> responses =
            ocorrenciaService.listarPorArea(-24, -47, -23, -46);

        assertThat(responses).containsExactly(responseFor(within));
        verify(ocorrenciaRepository).findWithinBoundingBox(-24, -47, -23, -46);
    }

    @Test
    void listarPorAreaDeveAceitarLimitesGeograficosValidos() {
        when(ocorrenciaRepository.findWithinBoundingBox(-90, -180, 90, 180))
            .thenReturn(List.of());

        assertThat(ocorrenciaService.listarPorArea(-90, -180, 90, 180)).isEmpty();

        verify(ocorrenciaRepository).findWithinBoundingBox(-90, -180, 90, 180);
    }

    private static Stream<org.junit.jupiter.params.provider.Arguments> limitesLatitudeInvalidos() {
        return Stream.of(
            org.junit.jupiter.params.provider.Arguments.of(-90.01, -10.0, 10.0, 10.0),
            org.junit.jupiter.params.provider.Arguments.of(-10.0, -10.0, 90.01, 10.0),
            org.junit.jupiter.params.provider.Arguments.of(10.0, -10.0, -10.0, 10.0),
            org.junit.jupiter.params.provider.Arguments.of(Double.NaN, -10.0, 10.0, 10.0),
            org.junit.jupiter.params.provider.Arguments.of(-10.0, -10.0, Double.POSITIVE_INFINITY, 10.0)
        );
    }

    private static Stream<org.junit.jupiter.params.provider.Arguments> limitesLongitudeInvalidos() {
        return Stream.of(
            org.junit.jupiter.params.provider.Arguments.of(-10.0, -180.01, 10.0, 10.0),
            org.junit.jupiter.params.provider.Arguments.of(-10.0, -10.0, 10.0, 180.01),
            org.junit.jupiter.params.provider.Arguments.of(-10.0, 10.0, 10.0, -10.0),
            org.junit.jupiter.params.provider.Arguments.of(-10.0, Double.NaN, 10.0, 10.0),
            org.junit.jupiter.params.provider.Arguments.of(-10.0, -10.0, 10.0, Double.NEGATIVE_INFINITY)
        );
    }

    private static CriarOcorrenciaRequest request(
        String titulo,
        String descricao,
        String categoria,
        String endereco,
        double latitude,
        double longitude
    ) {
        return new CriarOcorrenciaRequest(
            titulo, descricao, categoria, Boolean.TRUE, endereco, latitude, longitude
        );
    }

    private static CriarOcorrenciaRequest requestPadrao() {
        return request("Título", "Descrição", "buracos", "Endereço", 0, 0);
    }

    private static Ocorrencia ocorrencia(
        Long id,
        String titulo,
        double latitude,
        double longitude
    ) {
        Ocorrencia ocorrencia = new Ocorrencia(
            titulo,
            "Descrição de " + titulo,
            "buracos",
            "Endereço de " + titulo,
            Instant.parse("2026-01-01T12:00:00Z"),
            point(latitude, longitude)
        );
        ReflectionTestUtils.setField(ocorrencia, "id", id);
        return ocorrencia;
    }

    private static OcorrenciaResponse responseFor(Ocorrencia ocorrencia) {
        return new OcorrenciaResponse(
            ocorrencia.getId(),
            ocorrencia.getTitulo(),
            ocorrencia.getDescricao(),
            ocorrencia.getCategoria(),
            ocorrencia.getEndereco(),
            ocorrencia.getStatus(),
            ocorrencia.getDataCriacao(),
            ocorrencia.getLocalizacao().getY(),
            ocorrencia.getLocalizacao().getX()
        );
    }

    private static Point point(double latitude, double longitude) {
        return GEOMETRY_FACTORY.createPoint(new Coordinate(longitude, latitude));
    }

    private static void assertPoint(Point point, double longitude, double latitude) {
        assertThat(point.getSRID()).isEqualTo(4326);
        assertThat(point.getX()).isEqualTo(longitude);
        assertThat(point.getY()).isEqualTo(latitude);
    }

    private static void assertBadRequest(Runnable action, String expectedReason) {
        assertThatThrownBy(action::run)
            .isInstanceOf(ResponseStatusException.class)
            .satisfies(exception -> {
                ResponseStatusException statusException = (ResponseStatusException) exception;
                assertThat(statusException.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
                assertThat(statusException.getReason()).isEqualTo(expectedReason);
            });
    }
}
